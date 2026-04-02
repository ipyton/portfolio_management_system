package com.noah.portfolio.common;

import java.util.Locale;
import java.util.Map;

/**
 * Normalizes loose region strings into canonical short codes used by dashboard APIs.
 */
public final class RegionCodeNormalizer {

    private static final Map<String, String> REGION_ALIASES = Map.ofEntries(
            Map.entry("US", "US"),
            Map.entry("USA", "US"),
            Map.entry("UNITEDSTATES", "US"),
            Map.entry("UNITEDSTATESOFAMERICA", "US"),
            Map.entry("AMERICA", "US"),
            Map.entry("AMERICANEWYORK", "US"),
            Map.entry("NEWYORK", "US"),
            Map.entry("NYSE", "US"),
            Map.entry("NASDAQ", "US"),
            Map.entry("AMEX", "US"),
            Map.entry("OTC", "US"),

            Map.entry("CN", "CN"),
            Map.entry("CHINA", "CN"),
            Map.entry("MAINLANDCHINA", "CN"),
            Map.entry("PRC", "CN"),
            Map.entry("PEOPLESREPUBLICOFCHINA", "CN"),
            Map.entry("ASIASHANGHAI", "CN"),
            Map.entry("ASIABEIJING", "CN"),
            Map.entry("ASIACHONGQING", "CN"),
            Map.entry("SHANGHAI", "CN"),
            Map.entry("SHENZHEN", "CN"),
            Map.entry("BEIJING", "CN"),
            Map.entry("SSE", "CN"),
            Map.entry("SZSE", "CN"),

            Map.entry("HK", "HK"),
            Map.entry("HONGKONG", "HK"),
            Map.entry("HKSAR", "HK"),
            Map.entry("ASIAHONGKONG", "HK"),
            Map.entry("HKEX", "HK"),

            Map.entry("JP", "JP"),
            Map.entry("JAPAN", "JP"),
            Map.entry("TOKYO", "JP"),
            Map.entry("ASIATOKYO", "JP"),
            Map.entry("TSE", "JP"),

            Map.entry("UK", "UK"),
            Map.entry("GB", "UK"),
            Map.entry("GBR", "UK"),
            Map.entry("UNITEDKINGDOM", "UK"),
            Map.entry("GREATBRITAIN", "UK"),
            Map.entry("ENGLAND", "UK"),
            Map.entry("LONDON", "UK"),
            Map.entry("EUROPELONDON", "UK"),
            Map.entry("LSE", "UK"),

            Map.entry("DE", "DE"),
            Map.entry("GERMANY", "DE"),
            Map.entry("BERLIN", "DE"),
            Map.entry("EUROPEBERLIN", "DE"),
            Map.entry("XETRA", "DE"),

            Map.entry("FR", "FR"),
            Map.entry("FRANCE", "FR"),
            Map.entry("PARIS", "FR"),
            Map.entry("EUROPEPARIS", "FR"),

            Map.entry("AU", "AU"),
            Map.entry("AUSTRALIA", "AU"),
            Map.entry("SYDNEY", "AU"),
            Map.entry("OCEANIASYDNEY", "AU"),
            Map.entry("ASX", "AU"),

            Map.entry("IN", "IN"),
            Map.entry("INDIA", "IN"),
            Map.entry("MUMBAI", "IN"),
            Map.entry("ASIAMUMBAI", "IN"),
            Map.entry("BSE", "IN"),
            Map.entry("NSE", "IN"),

            Map.entry("KR", "KR"),
            Map.entry("KOREA", "KR"),
            Map.entry("SOUTHKOREA", "KR"),
            Map.entry("SEOUL", "KR"),
            Map.entry("ASIASEOUL", "KR"),

            Map.entry("CA", "CA"),
            Map.entry("CANADA", "CA"),
            Map.entry("TORONTO", "CA"),
            Map.entry("AMERICATORONTO", "CA"),
            Map.entry("TSX", "CA"),

            Map.entry("SG", "SG"),
            Map.entry("SINGAPORE", "SG"),
            Map.entry("ASIASINGAPORE", "SG"),

            Map.entry("TW", "TW"),
            Map.entry("TAIWAN", "TW"),
            Map.entry("TAIPEI", "TW"),
            Map.entry("ASIATAIPEI", "TW"),

            Map.entry("BR", "BR"),
            Map.entry("BRAZIL", "BR"),
            Map.entry("SAOPAULO", "BR"),
            Map.entry("AMERICASAOPAULO", "BR"),
            Map.entry("BOVESPA", "BR"),
            Map.entry("IBOVESPA", "BR")
    );

    private RegionCodeNormalizer() {
    }

    public static String normalize(String rawRegion) {
        if (rawRegion == null || rawRegion.isBlank()) {
            return null;
        }
        String normalized = rawRegion.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()
                || "UNKNOWN".equals(normalized)
                || "N/A".equals(normalized)
                || "NA".equals(normalized)
                || "NONE".equals(normalized)
                || "NULL".equals(normalized)) {
            return null;
        }

        String collapsed = normalized.replaceAll("[^A-Z0-9]", "");
        if (collapsed.isEmpty()) {
            return null;
        }

        String aliased = REGION_ALIASES.get(collapsed);
        if (aliased != null) {
            return aliased;
        }

        if (collapsed.length() == 2
                && Character.isLetter(collapsed.charAt(0))
                && Character.isLetter(collapsed.charAt(1))) {
            return "GB".equals(collapsed) ? "UK" : collapsed;
        }
        return null;
    }
}
