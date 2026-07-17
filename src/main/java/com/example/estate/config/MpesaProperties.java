package com.example.estate.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "mpesa")
public class MpesaProperties {

    /** Daraja API base URL. Defaults to production; override with MPESA_BASE_URL for sandbox testing. */
    private String baseUrl = "https://api.safaricom.co.ke";

    private String consumerKey;
    private String consumerSecret;
    private String shortcode;
    private String passkey;
    private String callbackUrl;
}
