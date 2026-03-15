package com.example.estate.dto;

import com.example.estate.enums.PaymentMethod;
import lombok.Data;
import java.util.List;

@Data
public class BulkPaymentRequest {
    private List<Long> ids;
    private PaymentMethod method;
    private String reference;
}
