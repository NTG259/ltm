package com.cplusplus.backend.controller;

import com.cplusplus.backend.master.service.JudgeMasterService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final JudgeMasterService judgeMasterService;

    public StatsController(JudgeMasterService judgeMasterService) {
        this.judgeMasterService = judgeMasterService;
    }

    @GetMapping("/online")
    public ResponseEntity<Map<String, Integer>> onlineCount() {
        int count = judgeMasterService.getOnlineStudentCount();
        return ResponseEntity.ok(Map.of("count", count));
    }
}
