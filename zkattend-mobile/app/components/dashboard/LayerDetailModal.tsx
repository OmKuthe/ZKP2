// zkattend-mobile/app/components/dashboard/LayerDetailModal.tsx
/**
 * Reusable modal for showing verification-layer details.
 *
 * One shell, three bodies:
 *   - face   : liveness outcome + timestamp + privacy note
 *   - wifi   : JSR score, threshold, anomaly status
 *   - chain  : totals + last 5 checks
 *
 * Parent owns data fetching. This component is presentation-only.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';

export type VerificationLayer = 'face' | 'wifi' | 'chain';

interface ContinuityCheck {
  id: number;
  check_number: number;
  check_time: string;
  status: string;
  hash_link: string;
  hash_link_valid: boolean;
  message: string;
}

interface LayerDetailModalProps {
  visible: boolean;
  layer: VerificationLayer | null;
  onClose: () => void;

  // Face
  faceVerified: boolean | null;
  faceVerifiedAt: string | null;

  // Wi-Fi
  wifiScore: number | null;
  wifiAnomaly: boolean;
  wifiCheckEnabled: boolean;

  // Chain
  continuityChecks: ContinuityCheck[];
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
    const time = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} · ${time}`;
  } catch {
    return '—';
  }
}

function formatCheckTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// -------------------------------------------------------------
// Face body
// -------------------------------------------------------------

const FaceBody: React.FC<{
  faceVerified: boolean | null;
  faceVerifiedAt: string | null;
}> = ({ faceVerified, faceVerifiedAt }) => {
  let statusColor = '#94a3b8';
  let statusLabel = 'Not attempted';
  let statusIcon = '○';

  if (faceVerified === true) {
    statusColor = '#16A34A';
    statusLabel = 'Verified';
    statusIcon = '✅';
  } else if (faceVerified === false) {
    statusColor = '#DC2626';
    statusLabel = 'Failed';
    statusIcon = '❌';
  }

  return (
    <>
      <View style={styles.statusRow}>
        <Text style={[styles.bigIcon, { color: statusColor }]}>
          {statusIcon}
        </Text>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Checked at</Text>
        <Text style={styles.detailValue}>
          {formatTimestamp(faceVerifiedAt)}
        </Text>
      </View>

      <Text style={styles.explainer}>
        Blink-transition check ran once before the session started. Only the
        boolean outcome and timestamp are stored — no face image, embedding,
        or landmark was ever captured to disk or sent to the server.
      </Text>
    </>
  );
};

// -------------------------------------------------------------
// Wi-Fi body
// -------------------------------------------------------------

const WifiBody: React.FC<{
  wifiScore: number | null;
  wifiAnomaly: boolean;
  wifiCheckEnabled: boolean;
}> = ({ wifiScore, wifiAnomaly, wifiCheckEnabled }) => {
  let statusColor = '#94a3b8';
  let statusLabel = 'Inactive';
  let statusIcon = '○';

  if (wifiCheckEnabled) {
    if (wifiAnomaly) {
      statusColor = '#F59E0B';
      statusLabel = 'Deviation detected';
      statusIcon = '⚠️';
    } else if (wifiScore !== null) {
      statusColor = '#16A34A';
      statusLabel = 'Verified';
      statusIcon = '✅';
    } else {
      statusColor = '#94a3b8';
      statusLabel = 'Awaiting first check';
      statusIcon = '○';
    }
  } else {
    statusLabel = 'Inactive (no template)';
    statusIcon = '⚪';
  }

  return (
    <>
      <View style={styles.statusRow}>
        <Text style={[styles.bigIcon, { color: statusColor }]}>
          {statusIcon}
        </Text>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Latest JSR score</Text>
        <Text style={styles.detailValue}>
          {wifiScore !== null ? wifiScore.toFixed(3) : '—'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Threshold</Text>
        <Text style={styles.detailValue}>0.700</Text>
      </View>

      <Text style={styles.explainer}>
        JSR similarity is computed against the Wi-Fi template captured at
        check-in. A score below 0.700 means the surrounding access points no
        longer match the enrolled fingerprint. Two consecutive failures
        raise a MEDIUM anomaly; four escalate to HIGH.
      </Text>
    </>
  );
};

// -------------------------------------------------------------
// Chain body
// -------------------------------------------------------------

const ChainBody: React.FC<{ checks: ContinuityCheck[] }> = ({ checks }) => {
  const total = checks.length;
  const verified = checks.filter((c) => c.status === 'verified').length;
  const failed = checks.filter((c) => c.status === 'failed').length;

  const lastFive = React.useMemo(() => {
    if (checks.length === 0) return [];
    return checks.slice(-5).reverse();
  }, [checks]);

  return (
    <>
      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{total}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#16A34A' }]}>
            {verified}
          </Text>
          <Text style={styles.metricLabel}>Verified</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: '#DC2626' }]}>
            {failed}
          </Text>
          <Text style={styles.metricLabel}>Failed</Text>
        </View>
      </View>

      {lastFive.length > 0 && (
        <View style={styles.recentBlock}>
          <Text style={styles.recentTitle}>Last 5 checks</Text>
          {lastFive.map((c) => (
            <View key={c.id} style={styles.checkRow}>
              <Text style={styles.checkTime}>
                {formatCheckTime(c.check_time)}
              </Text>
              <Text
                style={[
                  styles.checkStatus,
                  c.status === 'verified'
                    ? { color: '#16A34A' }
                    : c.status === 'failed'
                    ? { color: '#DC2626' }
                    : { color: '#F59E0B' },
                ]}
              >
                #{c.check_number} · {c.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.explainer}>
        Sequential SHA-256 hash chain: hₙ = SHA256(seed ‖ n). Each check must
        arrive in strict monotonic order — a replay or gap fails validation.
      </Text>
    </>
  );
};

// -------------------------------------------------------------
// Shell
// -------------------------------------------------------------

const LAYER_TITLES: Record<VerificationLayer, string> = {
  face: 'Face liveness',
  wifi: 'Wi-Fi fingerprint',
  chain: 'Hash chain',
};

const LayerDetailModal: React.FC<LayerDetailModalProps> = ({
  visible,
  layer,
  onClose,
  faceVerified,
  faceVerifiedAt,
  wifiScore,
  wifiAnomaly,
  wifiCheckEnabled,
  continuityChecks,
}) => {
  if (!layer) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{LAYER_TITLES[layer]}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.body}>
                {layer === 'face' && (
                  <FaceBody
                    faceVerified={faceVerified}
                    faceVerifiedAt={faceVerifiedAt}
                  />
                )}
                {layer === 'wifi' && (
                  <WifiBody
                    wifiScore={wifiScore}
                    wifiAnomaly={wifiAnomaly}
                    wifiCheckEnabled={wifiCheckEnabled}
                  />
                )}
                {layer === 'chain' && (
                  <ChainBody checks={continuityChecks} />
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  closeText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  bigIcon: {
    fontSize: 32,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  explainer: {
    marginTop: 20,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
    fontStyle: 'italic',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  recentBlock: {
    marginTop: 8,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  checkTime: {
    fontSize: 13,
    color: '#475569',
  },
  checkStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default LayerDetailModal;