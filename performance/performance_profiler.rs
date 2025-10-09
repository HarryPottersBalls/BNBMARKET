use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceCategory {
    // Transaction Processing Categories
    TransactionProcessing,
    MarketProbabilityCalculation,
    RiskAssessment,
    BlockchainInteraction,

    // System Categories
    DatabaseQuery,
    CacheOperation,
    NetworkCommunication,
    ConfigurationLoad,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetric {
    id: Uuid,
    category: PerformanceCategory,
    start_time: Instant,
    end_time: Option<Instant>,
    duration: Option<Duration>,
    additional_metadata: HashMap<String, String>,
}

pub struct PerformanceProfiler {
    // Active performance tracking
    active_metrics: Arc<Mutex<HashMap<Uuid, PerformanceMetric>>>,

    // Historical performance data
    performance_history: Arc<Mutex<Vec<PerformanceMetric>>>,

    // Configuration
    max_history_size: usize,
    sampling_rate: f64, // Percentage of operations to profile
}

impl PerformanceProfiler {
    pub fn new(sampling_rate: f64, max_history_size: usize) -> Self {
        PerformanceProfiler {
            active_metrics: Arc::new(Mutex::new(HashMap::new())),
            performance_history: Arc::new(Mutex::new(Vec::new())),
            max_history_size,
            sampling_rate: sampling_rate.clamp(0.0, 1.0),
        }
    }

    // Start performance tracking for an operation
    pub async fn start_tracking(&self, category: PerformanceCategory) -> Uuid {
        let metric_id = Uuid::new_v4();
        let metric = PerformanceMetric {
            id: metric_id,
            category,
            start_time: Instant::now(),
            end_time: None,
            duration: None,
            additional_metadata: HashMap::new(),
        };

        let mut active_metrics = self.active_metrics.lock().await;
        active_metrics.insert(metric_id, metric);

        metric_id
    }

    // Stop tracking and record performance
    pub async fn stop_tracking(&self, metric_id: Uuid) {
        let mut active_metrics = self.active_metrics.lock().await;

        if let Some(mut metric) = active_metrics.get_mut(&metric_id) {
            metric.end_time = Some(Instant::now());
            metric.duration = Some(metric.start_time.elapsed());

            // Add to performance history
            let mut history = self.performance_history.lock().await;

            // Manage history size
            if history.len() >= self.max_history_size {
                history.remove(0);
            }

            history.push(metric.clone());
        }

        // Remove from active metrics
        active_metrics.remove(&metric_id);
    }

    // Performance tracking for async operations
    pub async fn track_performance<F, T>(
        &self,
        category: PerformanceCategory,
        operation: F
    ) -> T
    where
        F: std::future::Future<Output = T>
    {
        // Probabilistic tracking
        let should_track = rand::random::<f64>() < self.sampling_rate;

        if should_track {
            let metric_id = self.start_tracking(category).await;
            let result = operation.await;
            self.stop_tracking(metric_id).await;
            result
        } else {
            operation.await
        }
    }

    // Analyze performance bottlenecks
    pub async fn analyze_performance_bottlenecks(&self) -> Vec<PerformanceMetric> {
        let history = self.performance_history.lock().await;

        // Sort by duration, descending
        let mut bottlenecks: Vec<PerformanceMetric> = history
            .iter()
            .filter_map(|metric| metric.duration.map(|d| (metric, d)))
            .filter(|(_, duration)| duration > &Duration::from_millis(100)) // Bottleneck threshold
            .sorted_by_key(|(_, duration)| std::cmp::Reverse(*duration))
            .take(10) // Top 10 bottlenecks
            .map(|(metric, _)| metric.clone())
            .collect();

        bottlenecks
    }

    // Generate performance report
    pub async fn generate_performance_report(&self) -> PerformanceReport {
        let history = self.performance_history.lock().await;

        let mut category_metrics: HashMap<PerformanceCategory, CategoryPerformance> = HashMap::new();

        for metric in history.iter() {
            if let Some(duration) = metric.duration {
                let entry = category_metrics
                    .entry(metric.category.clone())
                    .or_insert_with(CategoryPerformance::default);

                entry.total_operations += 1;
                entry.total_duration += duration;
                entry.max_duration = entry.max_duration.max(duration);
            }
        }

        PerformanceReport {
            timestamp: chrono::Utc::now(),
            category_metrics,
            bottlenecks: self.analyze_performance_bottlenecks().await,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryPerformance {
    pub total_operations: usize,
    pub total_duration: Duration,
    pub max_duration: Duration,
}

impl Default for CategoryPerformance {
    fn default() -> Self {
        CategoryPerformance {
            total_operations: 0,
            total_duration: Duration::default(),
            max_duration: Duration::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceReport {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub category_metrics: HashMap<PerformanceCategory, CategoryPerformance>,
    pub bottlenecks: Vec<PerformanceMetric>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time;

    #[tokio::test]
    async fn test_performance_tracking() {
        let profiler = PerformanceProfiler::new(1.0, 100);

        // Simulate a slow operation
        let result = profiler
            .track_performance(PerformanceCategory::TransactionProcessing, async {
                time::sleep(Duration::from_millis(50)).await;
                42
            })
            .await;

        assert_eq!(result, 42);

        // Generate performance report
        let report = profiler.generate_performance_report().await;

        // Basic assertions
        assert!(!report.category_metrics.is_empty());
        assert!(report.bottlenecks.len() <= 10);
    }
}