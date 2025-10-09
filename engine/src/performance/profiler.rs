use std::time::{Duration, Instant};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use tokio::sync::Mutex;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetric {
    operation: String,
    total_calls: u64,
    total_duration: Duration,
    max_duration: Duration,
    min_duration: Duration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceCategory {
    DatabaseQuery,
    TransactionProcessing,
    MarketProbabilityCalculation,
    AuthenticationVerification,
    APIEndpoint,
}

pub struct PerformanceProfiler {
    metrics: Arc<Mutex<HashMap<PerformanceCategory, Vec<PerformanceMetric>>>>,
    sampling_rate: f64, // Percentage of operations to profile
}

impl PerformanceProfiler {
    pub fn new(sampling_rate: f64) -> Self {
        PerformanceProfiler {
            metrics: Arc::new(Mutex::new(HashMap::new())),
            sampling_rate: sampling_rate.clamp(0.0, 1.0),
        }
    }

    pub async fn profile_operation<F, T>(&self, category: PerformanceCategory, operation_name: String, func: F) -> T
    where
        F: std::future::Future<Output = T>,
    {
        // Probabilistic profiling based on sampling rate
        let should_profile = rand::random::<f64>() < self.sampling_rate;

        let start = Instant::now();
        let result = func.await;
        let duration = start.elapsed();

        if should_profile {
            self.record_performance_metric(category, operation_name, duration).await;
        }

        result
    }

    async fn record_performance_metric(&self, category: PerformanceCategory, operation: String, duration: Duration) {
        let mut metrics = self.metrics.lock().await;

        let category_metrics = metrics.entry(category).or_insert_with(Vec::new);

        // Find or create metric for this operation
        if let Some(metric) = category_metrics.iter_mut().find(|m| m.operation == operation) {
            metric.total_calls += 1;
            metric.total_duration += duration;
            metric.max_duration = metric.max_duration.max(duration);
            metric.min_duration = metric.min_duration.min(duration);
        } else {
            category_metrics.push(PerformanceMetric {
                operation,
                total_calls: 1,
                total_duration: duration,
                max_duration: duration,
                min_duration: duration,
            });
        }
    }

    pub async fn generate_performance_report(&self) -> PerformanceReport {
        let metrics = self.metrics.lock().await;

        let mut report_categories = Vec::new();

        for (category, category_metrics) in metrics.iter() {
            let category_report = CategoryPerformanceReport {
                category: category.clone(),
                metrics: category_metrics.clone(),
                average_duration: category_metrics.iter()
                    .map(|m| m.total_duration / m.total_calls)
                    .collect(),
            };

            report_categories.push(category_report);
        }

        PerformanceReport {
            timestamp: chrono::Utc::now(),
            categories: report_categories,
        }
    }

    pub async fn identify_performance_bottlenecks(&self) -> Vec<PerformanceBottleneck> {
        let report = self.generate_performance_report().await;

        report.categories.iter()
            .flat_map(|category| {
                category.metrics.iter()
                    .filter_map(|metric| {
                        // Consider operations taking more than 100ms as potential bottlenecks
                        let avg_duration = metric.total_duration / metric.total_calls;
                        if avg_duration > Duration::from_millis(100) {
                            Some(PerformanceBottleneck {
                                category: category.category.clone(),
                                operation: metric.operation.clone(),
                                average_duration: avg_duration,
                            })
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .collect()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceReport {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub categories: Vec<CategoryPerformanceReport>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryPerformanceReport {
    pub category: PerformanceCategory,
    pub metrics: Vec<PerformanceMetric>,
    pub average_duration: Vec<Duration>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceBottleneck {
    pub category: PerformanceCategory,
    pub operation: String,
    pub average_duration: Duration,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time;

    #[tokio::test]
    async fn test_performance_profiler() {
        let profiler = PerformanceProfiler::new(1.0); // Profile 100% of operations

        // Simulate different operations
        let _ = profiler.profile_operation(
            PerformanceCategory::TransactionProcessing,
            "test_transaction".to_string(),
            async {
                time::sleep(Duration::from_millis(50)).await;
            }
        ).await;

        let report = profiler.generate_performance_report().await;
        assert!(!report.categories.is_empty());

        let bottlenecks = profiler.identify_performance_bottlenecks().await;
        println!("Performance Bottlenecks: {:?}", bottlenecks);
    }
}