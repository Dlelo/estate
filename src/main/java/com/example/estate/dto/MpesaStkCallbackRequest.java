package com.example.estate.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Mirrors the real Daraja STK push callback payload shape. */
public record MpesaStkCallbackRequest(
        @JsonProperty("Body") Body body
) {
    public record Body(
            @JsonProperty("stkCallback") StkCallback stkCallback
    ) {}

    public record StkCallback(
            @JsonProperty("MerchantRequestID") String merchantRequestId,
            @JsonProperty("CheckoutRequestID") String checkoutRequestId,
            @JsonProperty("ResultCode") int resultCode,
            @JsonProperty("ResultDesc") String resultDesc,
            @JsonProperty("CallbackMetadata") CallbackMetadata callbackMetadata
    ) {}

    public record CallbackMetadata(
            @JsonProperty("Item") List<Item> item
    ) {}

    public record Item(
            @JsonProperty("Name") String name,
            @JsonProperty("Value") Object value
    ) {}
}
