#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ProcessingCategory {
    Bridge,
    Powder,
    Billet,
    Oxidation,
    Electrophoresis,
}

pub const PROCESSING_CATEGORIES: [ProcessingCategory; 5] = [
    ProcessingCategory::Bridge,
    ProcessingCategory::Powder,
    ProcessingCategory::Billet,
    ProcessingCategory::Oxidation,
    ProcessingCategory::Electrophoresis,
];

impl ProcessingCategory {
    pub fn label(self) -> &'static str {
        match self {
            ProcessingCategory::Bridge => "断桥",
            ProcessingCategory::Powder => "喷涂",
            ProcessingCategory::Billet => "坯料",
            ProcessingCategory::Oxidation => "氧化",
            ProcessingCategory::Electrophoresis => "电泳",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct ProcessingFeeSnapshot {
    pub bridge: i64,
    pub powder: i64,
    pub billet: i64,
    pub oxidation: i64,
    pub electrophoresis: i64,
}

impl ProcessingFeeSnapshot {
    pub fn new(
        bridge: i64,
        powder: i64,
        billet: i64,
        oxidation: i64,
        electrophoresis: i64,
    ) -> Self {
        Self {
            bridge,
            powder,
            billet,
            oxidation,
            electrophoresis,
        }
    }

    pub fn get(self, category: ProcessingCategory) -> i64 {
        match category {
            ProcessingCategory::Bridge => self.bridge,
            ProcessingCategory::Powder => self.powder,
            ProcessingCategory::Billet => self.billet,
            ProcessingCategory::Oxidation => self.oxidation,
            ProcessingCategory::Electrophoresis => self.electrophoresis,
        }
    }

    pub fn has_any_positive(self) -> bool {
        PROCESSING_CATEGORIES
            .iter()
            .any(|category| self.get(*category) > 0)
    }
}

pub fn processing_category_from_color(color: &str) -> ProcessingCategory {
    matched_processing_categories(color)
        .first()
        .copied()
        .unwrap_or(ProcessingCategory::Powder)
}

pub fn checked_processing_category_from_color(color: &str) -> Result<ProcessingCategory, String> {
    let matches = matched_processing_categories(color);

    if matches.is_empty() {
        return Ok(ProcessingCategory::Powder);
    }

    if matches.len() > 1 {
        let labels = matches
            .iter()
            .map(|category| category.label())
            .collect::<Vec<_>>()
            .join("、");
        return Err(format!("颜色“{color}”同时命中{labels}，请检查颜色录入"));
    }

    Ok(matches[0])
}

fn matched_processing_categories(color: &str) -> Vec<ProcessingCategory> {
    let mut matches = Vec::new();

    if color.contains("坯料") {
        matches.push(ProcessingCategory::Billet);
    }

    if color.contains("双面") || (color.contains('外') && color.contains('内')) {
        matches.push(ProcessingCategory::Bridge);
    }

    if color.contains("氧化") {
        matches.push(ProcessingCategory::Oxidation);
    }

    if color.contains("1#色") || color.contains("2#色") || color.contains("3#色") {
        matches.push(ProcessingCategory::Electrophoresis);
    }

    matches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_billet_bridge_oxidation_electrophoresis_and_powder() {
        assert_eq!(
            processing_category_from_color("坯料"),
            ProcessingCategory::Billet
        );
        assert_eq!(
            processing_category_from_color("外咖啡 内白"),
            ProcessingCategory::Bridge
        );
        assert_eq!(
            processing_category_from_color("双面灰"),
            ProcessingCategory::Bridge
        );
        assert_eq!(
            processing_category_from_color("双面白"),
            ProcessingCategory::Bridge
        );
        assert_eq!(
            processing_category_from_color("国标氧化"),
            ProcessingCategory::Oxidation
        );
        assert_eq!(
            processing_category_from_color("非标氧化"),
            ProcessingCategory::Oxidation
        );
        assert_eq!(
            processing_category_from_color("1#色"),
            ProcessingCategory::Electrophoresis
        );
        assert_eq!(
            processing_category_from_color("2#色"),
            ProcessingCategory::Electrophoresis
        );
        assert_eq!(
            processing_category_from_color("3#色"),
            ProcessingCategory::Electrophoresis
        );
        assert_eq!(
            processing_category_from_color("灰色"),
            ProcessingCategory::Powder
        );
    }

    #[test]
    fn processing_fee_snapshot_reads_values_by_category() {
        let empty_snapshot = ProcessingFeeSnapshot::default();

        assert!(!empty_snapshot.has_any_positive());
        assert_eq!(ProcessingCategory::Bridge.label(), "断桥");
        assert_eq!(ProcessingCategory::Powder.label(), "喷涂");
        assert_eq!(ProcessingCategory::Billet.label(), "坯料");
        assert_eq!(ProcessingCategory::Oxidation.label(), "氧化");
        assert_eq!(ProcessingCategory::Electrophoresis.label(), "电泳");

        let snapshot = ProcessingFeeSnapshot::new(100, 200, 300, 450, 550);

        assert!(snapshot.has_any_positive());
        assert_eq!(snapshot.get(ProcessingCategory::Bridge), 100);
        assert_eq!(snapshot.get(ProcessingCategory::Powder), 200);
        assert_eq!(snapshot.get(ProcessingCategory::Billet), 300);
        assert_eq!(snapshot.get(ProcessingCategory::Oxidation), 450);
        assert_eq!(snapshot.get(ProcessingCategory::Electrophoresis), 550);
    }

    #[test]
    fn checked_classification_reports_oxidation_electrophoresis_conflict() {
        let error = checked_processing_category_from_color("国标氧化 1#色")
            .expect_err("should detect conflict");

        assert_eq!(
            error,
            "颜色“国标氧化 1#色”同时命中氧化、电泳，请检查颜色录入"
        );
    }

    #[test]
    fn checked_classification_reports_double_sided_conflict() {
        let error = checked_processing_category_from_color("双面氧化 1#色")
            .expect_err("should detect conflict");

        assert_eq!(
            error,
            "颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入"
        );
    }
}
