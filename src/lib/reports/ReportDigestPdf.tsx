import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatPrice } from "@/lib/utils/currency";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666666", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  label: { color: "#444444" },
  value: { fontWeight: 700 },
});

export type ReportDigestData = {
  tenantName: string;
  branchName: string;
  periodLabel: string;
  revenueMinor: number;
  orderCount: number;
  currency: string;
  // PDF, next-intl'in request-scope'lu React context'i olmayan bir cron/
  // internal-route bağlamında üretilir — çağıran taraf (scheduledDigest.ts)
  // etiketleri tenant'ın locale'iyle getTranslations({locale}) çağırarak
  // hazırlar, bileşen hardcoded metin taşımaz (CLAUDE.md i18n kuralı).
  labels: { revenue: string; orderCount: string };
};

export function ReportDigestPdf({ tenantName, branchName, periodLabel, revenueMinor, orderCount, currency, labels }: ReportDigestData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{tenantName} — {branchName}</Text>
        <Text style={styles.subtitle}>{periodLabel}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>{labels.revenue}</Text>
          <Text style={styles.value}>{formatPrice(revenueMinor, currency)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{labels.orderCount}</Text>
          <Text style={styles.value}>{orderCount}</Text>
        </View>
      </Page>
    </Document>
  );
}
