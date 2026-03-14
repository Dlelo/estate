package com.example.estate.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private static final long EXPIRATION = 1000 * 60 * 60 * 3; // 3 hours

    private final Key key;

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        // Pad or trim to exactly 32 bytes (256-bit) for HS256
        byte[] keyBytes = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] padded   = new byte[32];
        System.arraycopy(keyBytes, 0, padded, 0, Math.min(keyBytes.length, 32));
        this.key = Keys.hmacShaKeyFor(padded);
    }

    public String generateToken(String username, String role, Long userId) {
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION))
                .signWith(key)
                .compact();
    }

    public Claims extractClaims(String token) {
        return Jwts.parser()
                .setSigningKey(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUsername(String token) {
        return extractClaims(token).getSubject();
    }
}
