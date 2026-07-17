package com.example.estate.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

import java.util.Map;

/**
 * Without this, an unhandled RuntimeException thrown from a controller/service (e.g. "Contribution
 * not found", or DarajaClient failing to reach Safaricom) propagates uncaught through the security
 * filter chain and comes back to the client as a misleading 401 Unauthorized instead of a real error
 * — discovered while testing STK push with no M-Pesa credentials configured, but it affected every
 * endpoint in the app, not just payments.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Failures calling out to an external service (Safaricom Daraja, SendGrid, etc.) */
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<Map<String, String>> handleUpstreamFailure(RestClientException e) {
        log.error("Upstream service call failed", e);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", "Unable to reach an external service right now. Please try again shortly."));
    }

    /** The codebase's existing convention for expected business-rule violations
     *  ("not found", "already settled", "exceeds balance", etc.) */
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class, RuntimeException.class})
    public ResponseEntity<Map<String, String>> handleBusinessError(RuntimeException e) {
        log.warn("Request rejected: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(Map.of("message", e.getMessage() != null ? e.getMessage() : "Request could not be completed."));
    }
}
