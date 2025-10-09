use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use ethers::types::{Address, H256};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SecurityEventType {
    // Authentication Events
    LoginAttempt,
    LoginSuccess,
    LoginFailure,
    PasswordReset,

    // Transaction Events
    TransactionInitiated,
    TransactionBlocked,
    SuspiciousTransactionDetected,

    // Risk and Compliance
    RiskThresholdExceeded,
    ComplianceViolation,
    GeographicalRestriction,

    // System Security
    UnauthorizedAccessAttempt,
    IPWhitelistModification,
    CriticalSystemChange,

    // Market Specific
    MarketManipulationDetected,
    AnomalousBettingPattern,
    LiquidityRiskDetected,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub timestamp: DateTime<Utc>,
    pub event_type: SecurityEventType,
    pub user_address: Option<Address>,
    pub transaction_hash: Option<H256>,
    pub severity: SecurityEventSeverity,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum SecurityEventSeverity {
    Low,
    Medium,
    High,
    Critical,
}

pub struct SecurityLogger {
    // In-memory event store with optional persistent storage
    event_store: Arc<Mutex<Vec<SecurityEvent>>>,

    // External notification channels
    notification_channels: Vec<NotificationChannel>,
}

#[derive(Clone)]
enum NotificationChannel {
    Telegram(String),
    Slack(String),
    Email(String),
    PagerDuty(String),
}

impl SecurityLogger {
    pub fn new() -> Self {
        SecurityLogger {
            event_store: Arc::new(Mutex::new(Vec::new())),
            notification_channels: vec![
                // Configure notification channels
                // NotificationChannel::Telegram("telegram_bot_token".to_string()),
                // NotificationChannel::Slack("slack_webhook_url".to_string()),
            ],
        }
    }

    pub async fn log_security_event(&self, event: SecurityEvent) {
        // Log to in-memory store
        let mut store = self.event_store.lock().await;
        store.push(event.clone());

        // Tracing log (for console/file logging)
        match event.severity {
            SecurityEventSeverity::Critical => {
                error!(
                    event_type = ?event.event_type,
                    user_address = ?event.user_address,
                    "CRITICAL SECURITY EVENT DETECTED"
                );
                self.trigger_high_severity_alert(&event).await;
            },
            SecurityEventSeverity::High => {
                warn!(
                    event_type = ?event.event_type,
                    user_address = ?event.user_address,
                    "High Severity Security Event"
                );
                self.trigger_medium_severity_alert(&event).await;
            },
            SecurityEventSeverity::Medium => {
                info!(
                    event_type = ?event.event_type,
                    user_address = ?event.user_address,
                    "Medium Severity Security Event"
                );
            },
            SecurityEventSeverity::Low => {
                info!(
                    event_type = ?event.event_type,
                    user_address = ?event.user_address,
                    "Low Severity Security Event"
                );
            }
        }

        // Rotate/Trim event store if it gets too large
        if store.len() > 10000 {
            store.drain(..store.len() - 5000);
        }
    }

    async fn trigger_high_severity_alert(&self, event: &SecurityEvent) {
        // Implement multi-channel high-severity alerts
        for channel in &self.notification_channels {
            match channel {
                NotificationChannel::Telegram(token) => {
                    // Send Telegram alert
                    self.send_telegram_alert(token, event).await;
                },
                NotificationChannel::Slack(webhook) => {
                    // Send Slack notification
                    self.send_slack_alert(webhook, event).await;
                },
                _ => {}
            }
        }
    }

    async fn trigger_medium_severity_alert(&self, event: &SecurityEvent) {
        // Less aggressive alerting for medium severity events
        for channel in &self.notification_channels {
            match channel {
                NotificationChannel::Email(email) => {
                    self.send_email_alert(email, event).await;
                },
                _ => {}
            }
        }
    }

    // Placeholder methods for external notifications
    async fn send_telegram_alert(&self, _token: &str, event: &SecurityEvent) {
        // Implement Telegram bot alert logic
        println!("Telegram Alert: {:?}", event);
    }

    async fn send_slack_alert(&self, _webhook: &str, event: &SecurityEvent) {
        // Implement Slack webhook alert logic
        println!("Slack Alert: {:?}", event);
    }

    async fn send_email_alert(&self, _email: &str, event: &SecurityEvent) {
        // Implement email alert logic
        println!("Email Alert: {:?}", event);
    }

    // Retrieve recent security events
    pub async fn get_recent_events(&self, limit: usize) -> Vec<SecurityEvent> {
        let store = self.event_store.lock().await;
        store.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }

    // Export events for long-term storage/analysis
    pub async fn export_events(&self) -> Result<(), std::io::Error> {
        let store = self.event_store.lock().await;
        let json = serde_json::to_string_pretty(&*store)?;

        // Write to secure, rotated log file
        std::fs::write(
            format!("security_events_{}.json", Utc::now().format("%Y%m%d_%H%M%S")),
            json
        )
    }
}

// Helper function to create security events
pub fn create_security_event(
    event_type: SecurityEventType,
    user_address: Option<Address>,
    severity: SecurityEventSeverity,
    details: Option<String>
) -> SecurityEvent {
    SecurityEvent {
        timestamp: Utc::now(),
        event_type,
        user_address,
        transaction_hash: None,
        severity,
        details,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_security_event_logging() {
        let logger = SecurityLogger::new();

        let event = create_security_event(
            SecurityEventType::LoginAttempt,
            Some("0x1234567890123456789012345678901234567890".parse().unwrap()),
            SecurityEventSeverity::Medium,
            Some("Login attempt from new IP".to_string())
        );

        logger.log_security_event(event).await;

        let recent_events = logger.get_recent_events(1).await;
        assert_eq!(recent_events.len(), 1);
    }

    #[tokio::test]
    async fn test_event_export() {
        let logger = SecurityLogger::new();

        let event = create_security_event(
            SecurityEventType::TransactionBlocked,
            Some("0x1234567890123456789012345678901234567890".parse().unwrap()),
            SecurityEventSeverity::High,
            Some("Suspicious transaction blocked".to_string())
        );

        logger.log_security_event(event).await;

        assert!(logger.export_events().await.is_ok());
    }
}