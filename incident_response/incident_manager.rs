use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Duration, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum IncidentType {
    UnauthorizedAccess,
    SuspiciousTransaction,
    PotentialMarketManipulation,
    ConfigurationChange,
    SystemResourceExhaustion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncidentSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseAction {
    BlockUser,
    FreezeMarket,
    TriggerSystemWide2FA,
    RequireAdditionalVerification,
    NotifySecurityTeam,
    TemporarilyDisableFeatures,
    LockAccount,
    InitiateForensicAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncidentRecord {
    id: Uuid,
    incident_type: IncidentType,
    severity: IncidentSeverity,
    timestamp: DateTime<Utc>,
    user_id: Option<String>,
    source_ip: Option<String>,
    details: Option<String>,
    response_actions: Vec<ResponseAction>,
    status: IncidentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IncidentStatus {
    Detected,
    Investigating,
    Mitigated,
    Escalated,
    Resolved,
}

pub struct IncidentResponseManager {
    // Active incident tracking
    active_incidents: Arc<Mutex<HashMap<Uuid, IncidentRecord>>>,

    // Historical incident log
    incident_history: Arc<Mutex<Vec<IncidentRecord>>>,

    // Configuration for automatic response
    response_rules: HashMap<IncidentType, ResponseRuleSet>,

    // Tracking repeated offenses
    user_incident_count: Arc<Mutex<HashMap<String, usize>>>,
}

#[derive(Debug, Clone)]
struct ResponseRuleSet {
    severity_threshold: usize,
    actions: Vec<ResponseAction>,
    cooldown_period: Duration,
}

impl IncidentResponseManager {
    pub fn new() -> Self {
        IncidentResponseManager {
            active_incidents: Arc::new(Mutex::new(HashMap::new())),
            incident_history: Arc::new(Mutex::new(Vec::new())),
            response_rules: Self::default_response_rules(),
            user_incident_count: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn default_response_rules() -> HashMap<IncidentType, ResponseRuleSet> {
        let mut rules = HashMap::new();

        // Unauthorized Access Rules
        rules.insert(IncidentType::UnauthorizedAccess, ResponseRuleSet {
            severity_threshold: 3,
            actions: vec![
                ResponseAction::BlockUser,
                ResponseAction::TriggerSystemWide2FA,
                ResponseAction::NotifySecurityTeam,
            ],
            cooldown_period: Duration::hours(24),
        });

        // Suspicious Transaction Rules
        rules.insert(IncidentType::SuspiciousTransaction, ResponseRuleSet {
            severity_threshold: 2,
            actions: vec![
                ResponseAction::FreezeMarket,
                ResponseAction::RequireAdditionalVerification,
                ResponseAction::InitiateForensicAnalysis,
            ],
            cooldown_period: Duration::hours(12),
        });

        rules
    }

    pub fn record_incident(
        &self,
        incident_type: IncidentType,
        severity: IncidentSeverity,
        user_id: Option<String>,
        source_ip: Option<String>,
        details: Option<String>,
    ) -> Uuid {
        let incident_id = Uuid::new_v4();
        let mut response_actions = Vec::new();

        // Determine response actions based on incident type
        if let Some(rule_set) = self.response_rules.get(&incident_type) {
            // Check user incident count
            let mut user_incidents = self.user_incident_count.lock().unwrap();
            let user_incident_count = user_incidents
                .entry(user_id.clone().unwrap_or_default())
                .or_insert(0);

            // Increment incident count
            *user_incident_count += 1;

            // Check if threshold is met
            if *user_incident_count >= rule_set.severity_threshold {
                response_actions.extend(rule_set.actions.clone());
            }
        }

        let incident = IncidentRecord {
            id: incident_id,
            incident_type,
            severity,
            timestamp: Utc::now(),
            user_id,
            source_ip,
            details,
            response_actions,
            status: IncidentStatus::Detected,
        };

        // Store incident
        let mut active_incidents = self.active_incidents.lock().unwrap();
        active_incidents.insert(incident_id, incident.clone());

        // Log to history
        let mut incident_history = self.incident_history.lock().unwrap();
        incident_history.push(incident.clone());

        incident_id
    }

    pub fn get_incident_details(&self, incident_id: Uuid) -> Option<IncidentRecord> {
        let active_incidents = self.active_incidents.lock().unwrap();
        active_incidents.get(&incident_id).cloned()
    }

    pub fn execute_response_actions(&self, incident_id: Uuid) {
        let mut active_incidents = self.active_incidents.lock().unwrap();

        if let Some(incident) = active_incidents.get_mut(&incident_id) {
            // Execute response actions
            for action in &incident.response_actions {
                self.perform_response_action(action, &incident);
            }

            // Update incident status
            incident.status = IncidentStatus::Mitigated;
        }
    }

    fn perform_response_action(&self, action: &ResponseAction, incident: &IncidentRecord) {
        match action {
            ResponseAction::BlockUser => {
                if let Some(user_id) = &incident.user_id {
                    println!("Blocking user: {}", user_id);
                    // Implement actual user blocking logic
                }
            },
            ResponseAction::FreezeMarket => {
                println!("Freezing market due to suspicious activity");
                // Implement market freezing logic
            },
            ResponseAction::NotifySecurityTeam => {
                println!("Notifying security team about incident: {:?}", incident);
                // Implement notification mechanism
            },
            _ => {
                println!("Performing response action: {:?}", action);
                // Handle other response actions
            }
        }
    }

    pub fn get_recent_incidents(&self, limit: usize) -> Vec<IncidentRecord> {
        let incident_history = self.incident_history.lock().unwrap();
        incident_history
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_incident_recording_and_response() {
        let incident_manager = IncidentResponseManager::new();

        // Record a suspicious transaction incident
        let incident_id = incident_manager.record_incident(
            IncidentType::SuspiciousTransaction,
            IncidentSeverity::High,
            Some("user123".to_string()),
            Some("192.168.1.100".to_string()),
            Some("Multiple rapid transactions detected"),
        );

        // Retrieve incident details
        let incident = incident_manager.get_incident_details(incident_id);
        assert!(incident.is_some());

        // Execute response actions
        incident_manager.execute_response_actions(incident_id);

        // Check recent incidents
        let recent_incidents = incident_manager.get_recent_incidents(10);
        assert!(!recent_incidents.is_empty());
    }
}