// zkattend-mobile/app/components/dashboard/VerificationStrip.tsx
/**
 * Horizontal strip showing the three verification layers as tappable icons.
 *
 * Tap an icon → parent opens a modal with that layer's details.
 * No data fetching here — the parent already has the state.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

export type FaceLayerState = 'verified' | 'failed' | 'not_run';
export type WifiLayerState =
  | 'verified'
  | 'warning'
  | 'inactive'
  | 'not_run';
export type ChainLayerState = 'verified' | 'failed' | 'not_run';

export type VerificationLayer = 'face' | 'wifi' | 'chain';

interface VerificationStripProps {
  faceState: FaceLayerState;
  wifiState: WifiLayerState;
  chainState: ChainLayerState;
  onLayerPress: (layer: VerificationLayer) => void;
}

interface LayerVisual {
  icon: string;
  color: string;
  label: string;
}

function faceVisual(state: FaceLayerState): LayerVisual {
  switch (state) {
    case 'verified':
      return { icon: '🧠', color: '#16A34A', label: 'Face' };
    case 'failed':
      return { icon: '🧠', color: '#DC2626', label: 'Face' };
    case 'not_run':
    default:
      return { icon: '🧠', color: '#cbd5e1', label: 'Face' };
  }
}

function wifiVisual(state: WifiLayerState): LayerVisual {
  switch (state) {
    case 'verified':
      return { icon: '📶', color: '#16A34A', label: 'Wi-Fi' };
    case 'warning':
      return { icon: '📶', color: '#F59E0B', label: 'Wi-Fi' };
    case 'inactive':
      return { icon: '📶', color: '#94a3b8', label: 'Wi-Fi' };
    case 'not_run':
    default:
      return { icon: '📶', color: '#cbd5e1', label: 'Wi-Fi' };
  }
}

function chainVisual(state: ChainLayerState): LayerVisual {
  switch (state) {
    case 'verified':
      return { icon: '🔗', color: '#16A34A', label: 'Chain' };
    case 'failed':
      return { icon: '🔗', color: '#DC2626', label: 'Chain' };
    case 'not_run':
    default:
      return { icon: '🔗', color: '#cbd5e1', label: 'Chain' };
  }
}

interface LayerChipProps {
  visual: LayerVisual;
  onPress: () => void;
}

const LayerChip: React.FC<LayerChipProps> = ({ visual, onPress }) => (
  <TouchableOpacity
    style={styles.chip}
    onPress={onPress}
    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
    activeOpacity={0.6}
    accessibilityRole="button"
    accessibilityLabel={`${visual.label} verification, tap for details`}
  >
    <Text style={styles.chipIcon}>{visual.icon}</Text>
    <Text style={[styles.chipLabel, { color: visual.color }]}>
      {visual.label}
    </Text>
  </TouchableOpacity>
);

const VerificationStrip: React.FC<VerificationStripProps> = ({
  faceState,
  wifiState,
  chainState,
  onLayerPress,
}) => {
  return (
    <View style={styles.container}>
      <LayerChip
        visual={faceVisual(faceState)}
        onPress={() => onLayerPress('face')}
      />
      <View style={styles.separator} />
      <LayerChip
        visual={wifiVisual(wifiState)}
        onPress={() => onLayerPress('wifi')}
      />
      <View style={styles.separator} />
      <LayerChip
        visual={chainVisual(chainState)}
        onPress={() => onLayerPress('chain')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },
});

export default VerificationStrip;