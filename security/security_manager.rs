use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityThreatLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityEventType {
    // Authentication Events
    LoginAttempt,
    LoginSuccess,
    LoginFailure,

    // Transaction Events
    TransactionInitiated,
    TransactionBlocked,
    SuspiciousBehaviorDetected,

    // System Security
    UnauthorizedAccessAttempt,
    SystemConfigurationChange,
    CriticalSecurityEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub event_type: SecurityEventType,
    pub threat_level: SecurityThreatLevel,
    pub source_ip: Option<String>,
    pub user_id: Option<String>,
    pub details: Option<String>,
}

pub struct SecurityManager {
    // Threat detection configuration
    threat_thresholds: HashMap<SecurityEventType, SecurityThreatLevel>,

    // Blacklist and tracking
    ip_blacklist: HashSet<String>,
    user_blacklist: HashSet<String>,

    // Event storage and analysis
    event_log: Vec<SecurityEvent>,
    max_event_log_size: usize,
}

impl SecurityManager {
    pub fn new() -> Self {
        SecurityManager {
            threat_thresholds: Self::default_threat_thresholds(),
            ip_blacklist: HashSet::new(),
            user_blacklist: HashSet::new(),
            event_log: Vec::new(),
            max_event_log_size: 1000,
        }
    }

    fn default_threat_thresholds() -> HashMap<SecurityEventType, SecurityThreatLevel> {
        let mut thresholds = HashMap::new();
        thresholds.insert(SecurityEventType::LoginFailure, SecurityThreatLevel::Medium);
        thresholds.insert(SecurityEventType::UnauthorizedAccessAttempt, SecurityThreatLevel::High);
        thresholds.insert(SecurityEventType::SuspiciousBehaviorDetected, SecurityThreatLevel::Critical);
        thresholds
    }

    pub fn log_security_event(&mut self, event: SecurityEvent) {
        // Manage event log size
        if self.event_log.len() >= self.max_event_log_size {
            self.event_log.remove(0);
        }
        self.event_log.push(event.clone());

        // Automatic threat response
        self.evaluate_threat(&event);
    }

    fn evaluate_threat(&mut self, event: &SecurityEvent) {
        // Determine threat level and take automatic actions
        match event.threat_level {
            SecurityThreatLevel::High | SecurityThreatLevel::Critical => {
                if let Some(ip) = &event.source_ip {
                    self.ip_blacklist.insert(ip.clone());
                }
                if let Some(user_id) = &event.user_id {
                    self.user_blacklist.insert(user_id.clone());
                }

                // Trigger high-priority alerts
                self.trigger_security_alert(event);
            }
            _ => {} // Lower threat levels don't trigger automatic actions
        }
    }

    fn trigger_security_alert(&self, event: &SecurityEvent) {
        // In a real system, this would:
        // 1. Send notifications to security team
        // 2. Log to external monitoring system
        // 3. Potentially trigger automated incident response
        println!("SECURITY ALERT: {:?}", event);
    }

    pub fn is_ip_blacklisted(&self, ip: &str) -> bool {
        self.ip_blacklist.contains(ip)
    }

    pub fn is_user_blacklisted(&self, user_id: &str) -> bool {
        self.user_blacklist.contains(user_id)
    }

    pub fn get_recent_events(&self, limit: usize) -> Vec<SecurityEvent> {
        self.event_log
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
}

// Example usage and testing
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_event_logging() {
        let mut security_manager = SecurityManager::new();

        let login_event = SecurityEvent {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            event_type: SecurityEventType::LoginFailure,
            threat_level: SecurityThreatLevel::Medium,
            source_ip: Some("192.168.1.100".to_string()),
            user_id: Some("user123".to_string()),
            details: Some("Multiple failed login attempts".to_string()),
        };

        security_manager.log_security_event(login_event.clone());

        // Check event was logged
        assert_eq!(security_manager.event_log.len(), 1);

        // Check blacklisting
        assert!(security_manager.is_ip_blacklisted("192.168.1.100"));
        assert!(security_manager.is_user_blacklisted("user123"));
    }
}