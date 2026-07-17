package com.example.estate.service;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
public class EmailService {

    @Value("${sendgrid.api-key}")
    private String apiKey;

    @Value("${sendgrid.from-email}")
    private String fromEmail;

    public record Result(boolean success, String error) {
        public static Result ok() { return new Result(true, null); }
        public static Result failed(String error) { return new Result(false, error); }
    }

    /** Sends an email asynchronously. Never throws — failures are captured in the returned Result. */
    @Async("notificationExecutor")
    public CompletableFuture<Result> send(String to, String subject, String body) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("SendGrid API key not configured — skipping email to {}", to);
            return CompletableFuture.completedFuture(Result.failed("Email provider not configured"));
        }

        try {
            Mail mail = new Mail(new Email(fromEmail), subject, new Email(to), new Content("text/plain", body));
            SendGrid sg = new SendGrid(apiKey);
            Request request = new Request();
            request.setMethod(Method.POST);
            request.setEndpoint("mail/send");
            request.setBody(mail.build());

            Response response = sg.api(request);
            if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
                return CompletableFuture.completedFuture(Result.ok());
            }
            log.warn("SendGrid send to {} failed with status {}: {}", to, response.getStatusCode(), response.getBody());
            return CompletableFuture.completedFuture(Result.failed("SendGrid returned status " + response.getStatusCode()));
        } catch (Exception e) {
            log.error("Failed to send email to {}", to, e);
            return CompletableFuture.completedFuture(Result.failed(e.getMessage()));
        }
    }
}
