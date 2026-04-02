package com.noah.portfolio.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RegionCodeNormalizerTest {

    @Test
    void normalizeMapsCommonAliasesAndTimezones() {
        assertThat(RegionCodeNormalizer.normalize("United States")).isEqualTo("US");
        assertThat(RegionCodeNormalizer.normalize("America/New_York")).isEqualTo("US");
        assertThat(RegionCodeNormalizer.normalize("Asia/Shanghai")).isEqualTo("CN");
        assertThat(RegionCodeNormalizer.normalize("Great Britain")).isEqualTo("UK");
        assertThat(RegionCodeNormalizer.normalize("gb")).isEqualTo("UK");
        assertThat(RegionCodeNormalizer.normalize("  hk ")).isEqualTo("HK");
    }

    @Test
    void normalizeReturnsNullForUnknownOrBlankInput() {
        assertThat(RegionCodeNormalizer.normalize(null)).isNull();
        assertThat(RegionCodeNormalizer.normalize("")).isNull();
        assertThat(RegionCodeNormalizer.normalize("  ")).isNull();
        assertThat(RegionCodeNormalizer.normalize("UNKNOWN")).isNull();
        assertThat(RegionCodeNormalizer.normalize("N/A")).isNull();
    }
}
