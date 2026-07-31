// zkattend-mobile/app/components/ZKPWebView.tsx
import React, { useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ActivityIndicator, 
  Text, 
  TouchableOpacity,
  SafeAreaView 
} from 'react-native';
import { WebView } from 'react-native-webview';

interface ZKPWebViewProps {
  wasmData: string;
  zkeyData: string;
  inputData: any;
  onProofGenerated: (proof: any, publicSignals: string[]) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

const ZKPWebView: React.FC<ZKPWebViewProps> = ({
  wasmData,
  zkeyData,
  inputData,
  onProofGenerated,
  onError,
  onClose,
}) => {
  const webViewRef = useRef<WebView>(null);

  const handleMessage = (event: any) => {
    try {
      const rawData = event.nativeEvent.data;
      console.log('📩 WebView message received');
      
      const data = JSON.parse(rawData);
      
      if (data.type === 'proof') {
        console.log('✅ Proof received from WebView');
        // Data is already sanitized (no BigInts)
        onProofGenerated(data.proof, data.publicSignals);
        onClose();
      } else if (data.type === 'error') {
        console.log('❌ WebView error:', data.error);
        onError(data.error || 'Unknown WebView error');
        onClose();
      } else if (data.type === 'ready') {
        console.log('✅ WebView ready, sending circuit data...');
        // Send data to WebView
        const message = JSON.stringify({
          type: 'start',
          wasm: wasmData,
          zkey: zkeyData,
          input: inputData,
        });
        webViewRef.current?.postMessage(message);
      }
    } catch (error) {
      console.error('❌ Failed to parse WebView message:', error);
      onError('Failed to parse WebView message');
      onClose();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={onClose} 
          style={styles.cancelButton}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Generating Proof...</Text>
        <View style={{ width: 80 }} />
      </View>

      <WebView
        ref={webViewRef}
        source={require('../../webview/proof_generator.html')}
        onMessage={handleMessage}
        onLoadEnd={() => console.log('✅ WebView loaded')}
        onLoadStart={() => console.log('🔄 WebView loading started')}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('❌ WebView error:', nativeEvent);
          onError(`WebView error: ${nativeEvent.description || 'Unknown error'}`);
          onClose();
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading ZK circuit...</Text>
          </View>
        )}
        style={styles.webview}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#DC2626',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a5b4fc',
    marginTop: 12,
    fontSize: 16,
  },
});

export default ZKPWebView;