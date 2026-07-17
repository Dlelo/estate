package com.example.estate.service;

import com.example.estate.config.MpesaProperties;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.ZoneId;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/** Thin client for Safaricom Daraja's OAuth + STK Push (Lipa Na M-Pesa Online) APIs. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DarajaClient {

    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneId.of("Africa/Nairobi"));

    private static final ParameterizedTypeReference<Map<String, Object>> JSON_MAP =
            new ParameterizedTypeReference<>() {};

    private final MpesaProperties properties;

    private final RestClient restClient = RestClient.create();

    private volatile String cachedToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;

    private synchronized String getAccessToken() {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt)) {
            return cachedToken;
        }

        String credentials = Base64.getEncoder().encodeToString(
                (properties.getConsumerKey() + ":" + properties.getConsumerSecret()).getBytes());

        Map<String, Object> response = restClient.get()
                .uri(properties.getBaseUrl() + "/oauth/v1/generate?grant_type=client_credentials")
                .header("Authorization", "Basic " + credentials)
                .retrieve()
                .body(JSON_MAP);

        if (response == null || response.get("access_token") == null) {
            throw new IllegalStateException("Daraja OAuth token request returned no access_token");
        }

        cachedToken = response.get("access_token").toString();
        long expiresIn = Long.parseLong(response.getOrDefault("expires_in", "3599").toString());
        tokenExpiresAt = Instant.now().plusSeconds(Math.max(expiresIn - 60, 30));

        return cachedToken;
    }

    /** Initiates an STK push prompt on the payer's phone. Returns Daraja's request-tracking IDs. */
    public StkPushResult initiateStkPush(String phoneNumber, long amount, String accountReference, String description) {
        String timestamp = TIMESTAMP_FORMAT.format(Instant.now());
        String password = Base64.getEncoder().encodeToString(
                (properties.getShortcode() + properties.getPasskey() + timestamp).getBytes());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("BusinessShortCode", properties.getShortcode());
        body.put("Password", password);
        body.put("Timestamp", timestamp);
        body.put("TransactionType", "CustomerPayBillOnline");
        body.put("Amount", amount);
        body.put("PartyA", phoneNumber);
        body.put("PartyB", properties.getShortcode());
        body.put("PhoneNumber", phoneNumber);
        body.put("CallBackURL", properties.getCallbackUrl());
        body.put("AccountReference", accountReference);
        body.put("TransactionDesc", description);

        Map<String, Object> response = restClient.post()
                .uri(properties.getBaseUrl() + "/mpesa/stkpush/v1/processrequest")
                .header("Authorization", "Bearer " + getAccessToken())
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JSON_MAP);

        if (response == null) {
            throw new IllegalStateException("Daraja STK push request returned no response body");
        }

        String responseCode = String.valueOf(response.get("ResponseCode"));
        if (!"0".equals(responseCode)) {
            log.warn("Daraja STK push rejected: {}", response);
            throw new IllegalStateException("STK push failed: " + response.getOrDefault("ResponseDescription", "unknown error"));
        }

        return new StkPushResult(
                String.valueOf(response.get("MerchantRequestID")),
                String.valueOf(response.get("CheckoutRequestID")),
                String.valueOf(response.getOrDefault("CustomerMessage", "Check your phone to complete payment."))
        );
    }

    /**
     * Queries Daraja for the outcome of a previously-initiated STK push — used by the
     * reconciliation job when Safaricom's own callback never arrives. Safaricom returns an
     * error response (caught by the caller) while the transaction is still being processed,
     * so a null resultCode here means "no definitive result yet", not failure.
     */
    public StkQueryResult queryStkPushStatus(String checkoutRequestId) {
        String timestamp = TIMESTAMP_FORMAT.format(Instant.now());
        String password = Base64.getEncoder().encodeToString(
                (properties.getShortcode() + properties.getPasskey() + timestamp).getBytes());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("BusinessShortCode", properties.getShortcode());
        body.put("Password", password);
        body.put("Timestamp", timestamp);
        body.put("CheckoutRequestID", checkoutRequestId);

        Map<String, Object> response = restClient.post()
                .uri(properties.getBaseUrl() + "/mpesa/stkpushquery/v1/query")
                .header("Authorization", "Bearer " + getAccessToken())
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JSON_MAP);

        if (response == null || response.get("ResultCode") == null) {
            return new StkQueryResult(null, "No definitive result yet");
        }

        return new StkQueryResult(
                Integer.valueOf(String.valueOf(response.get("ResultCode"))),
                String.valueOf(response.getOrDefault("ResultDesc", "")));
    }

    @Data
    public static class StkPushResult {
        private final String merchantRequestId;
        private final String checkoutRequestId;
        private final String customerMessage;
    }

    @Data
    public static class StkQueryResult {
        /** Null means Safaricom has no definitive result yet (transaction still processing). */
        private final Integer resultCode;
        private final String resultDesc;
    }
}
