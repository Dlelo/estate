package com.example.estate.service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class SmsService {

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.from-number}")
    private String fromNumber;

    private boolean configured;

    @PostConstruct
    void init() {
        configured = accountSid != null && !accountSid.isBlank()
                && authToken != null && !authToken.isBlank();
        if (configured) {
            Twilio.init(accountSid, authToken);
        }
    }

    public record Result(boolean success, String error) {
        public static Result ok() { return new Result(true, null); }
        public static Result failed(String error) { return new Result(false, error); }
    }

    /** Sends an SMS asynchronously. Never throws — failures are captured in the returned Result. */
    @Async("notificationExecutor")
    public CompletableFuture<Result> send(String toPhoneNumber, String message) {
        if (!configured) {
            log.warn("Twilio not configured — skipping SMS to {}", toPhoneNumber);
            return CompletableFuture.completedFuture(Result.failed("SMS provider not configured"));
        }

        try {
            Message.creator(
                    new PhoneNumber(normalizePhoneNumber(toPhoneNumber)),
                    new PhoneNumber(fromNumber),
                    message
            ).create();
            return CompletableFuture.completedFuture(Result.ok());
        } catch (Exception e) {
            log.error("Failed to send SMS to {}", toPhoneNumber, e);
            return CompletableFuture.completedFuture(Result.failed(e.getMessage()));
        }
    }

    /** Normalizes 07XXXXXXXX / 7XXXXXXXX / 2547XXXXXXXX into E.164 (+2547XXXXXXXX). */
    private String normalizePhoneNumber(String phoneNumber) {
        String digits = phoneNumber.replaceAll("[^0-9]", "");
        if (digits.startsWith("254")) return "+" + digits;
        if (digits.startsWith("0")) return "+254" + digits.substring(1);
        return "+254" + digits;
    }
}
