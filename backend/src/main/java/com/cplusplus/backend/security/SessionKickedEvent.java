package com.cplusplus.backend.security;

import org.springframework.context.ApplicationEvent;

public class SessionKickedEvent extends ApplicationEvent {

    private final Long userId;

    public SessionKickedEvent(Object source, Long userId) {
        super(source);
        this.userId = userId;
    }

    public Long getUserId() {
        return userId;
    }
}
