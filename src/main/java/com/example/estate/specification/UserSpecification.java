package com.example.estate.specification;

import com.example.estate.model.User;
import org.springframework.data.jpa.domain.Specification;

public class UserSpecification {

    public static Specification<User> hasFullName(String name) {
        return (root, query, cb) ->
                name == null ? null :
                        cb.like(cb.lower(root.get("fullName")),
                                "%" + name.toLowerCase() + "%");
    }

    public static Specification<User> hasPhone(String phone) {
        return (root, query, cb) ->
                phone == null ? null :
                        cb.like(root.get("phoneNumber"),
                                "%" + phone + "%");
    }

    public static Specification<User> isActive(Boolean active) {
        return (root, query, cb) ->
                active == null ? null :
                        cb.equal(root.get("active"), active);
    }

    public static Specification<User> isNotDeleted() {
        return (root, query, cb) ->
                cb.isFalse(root.get("deleted"));
    }
}
