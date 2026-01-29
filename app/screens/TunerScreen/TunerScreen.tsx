// app/screens/TunerScreen/TunerScreen.tsx

import React, { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Dimensions } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Ionicons } from '@expo/vector-icons';
import { 
  startPitchDetection, 
  requestMicrophonePermission, 
  PitchResult, 
  calculateCents,
  getNoteFrequency 
} from "../../util/pitchDetection";
import * as Sentry from '@sentry/react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TunerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [isListening, setIsListening] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<PitchResult | null>(null);
  const [cents, setCents] = useState(0);
  
  const stopDetectionRef = useRef<(() => void) | null>(null);
  const needleRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopDetectionRef.current) {
        stopDetectionRef.current();
        stopDetectionRef.current = null;
      }
    };
  }, []);

  // Animate needle based on cents
  useEffect(() => {
    if (cents !== 0) {
      // Map cents (-50 to +50) to rotation (-45 to +45 degrees)
      const rotation = Math.max(-45, Math.min(45, cents * 0.9));
      
      Animated.spring(needleRotation, {
        toValue: rotation,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }).start();
    }
  }, [cents]);

  // Pulse animation when in tune
  useEffect(() => {
    if (Math.abs(cents) <= 5) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [cents]);

  const toggleListening = async () => {
    if (isListening) {
      // Stop listening
      if (stopDetectionRef.current) {
        stopDetectionRef.current();
        stopDetectionRef.current = null;
      }
      setIsListening(false);
      setCurrentPitch(null);
      setCents(0);
      
      // Reset needle
      Animated.spring(needleRotation, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      // Start listening
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        Alert.alert(
          'Microphone Permission Required',
          'VoiceVault needs microphone access to tune. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsListening(true);

      try {
        stopDetectionRef.current = startPitchDetection(
          (result) => {
            setCurrentPitch(result);
            const centsOff = calculateCents(result.frequency);
            setCents(centsOff);
          },
          (error) => {
            console.error('Pitch detection error:', error);
            Sentry.captureException(error, {
              tags: { component: 'TunerScreen', action: 'pitchDetectionError' }
            });
            Alert.alert(
              'Microphone Error',
              error.message + '\n\nPlease screenshot this error and report it.',
              [{ text: 'OK', onPress: () => {
                setIsListening(false);
                setCurrentPitch(null);
                setCents(0);
              }}]
            );
          },
          false // Don't use mock data
        );
      } catch (err: any) {
        console.error('Failed to start pitch detection:', err);
        Sentry.captureException(err, {
          tags: { component: 'TunerScreen', action: 'startPitchDetectionFailed' }
        });
        Alert.alert('Error', 'Failed to start tuner: ' + err.message);
        setIsListening(false);
      }
    }
  };

  const getTuningStatus = () => {
    const absCents = Math.abs(cents);
    if (absCents <= 5) return { text: '✓ Perfect', color: colors.success || '#4CAF50' };
    if (absCents <= 15) return { text: 'Close', color: colors.warning || '#FFA500' };
    if (cents > 0) return { text: 'Sharp ↑', color: colors.danger || '#FF5252' };
    return { text: 'Flat ↓', color: colors.danger || '#FF5252' };
  };

  const status = getTuningStatus();
  const targetFreq = currentPitch ? getNoteFrequency(currentPitch.note, currentPitch.octave) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chromatic Tuner</Text>
      
      {/* Main display area */}
      <View style={styles.displayContainer}>
        {currentPitch ? (
          <>
            {/* Note display */}
            <Animated.View style={[styles.noteContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={[styles.note, Math.abs(cents) <= 5 && { color: status.color }]}>
                {currentPitch.note}
              </Text>
              <Text style={styles.octave}>{currentPitch.octave}</Text>
            </Animated.View>

            {/* Frequency display */}
            <Text style={styles.frequency}>{currentPitch.frequency.toFixed(2)} Hz</Text>
            
            {/* Target frequency */}
            {targetFreq > 0 && (
              <Text style={styles.targetFreq}>Target: {targetFreq.toFixed(2)} Hz</Text>
            )}

            {/* Tuning meter */}
            <View style={styles.meterContainer}>
              {/* Scale marks */}
              <View style={styles.scaleContainer}>
                <Text style={styles.scaleMark}>-50</Text>
                <Text style={styles.scaleMark}>-25</Text>
                <Text style={[styles.scaleMark, styles.centerMark]}>0</Text>
                <Text style={styles.scaleMark}>+25</Text>
                <Text style={styles.scaleMark}>+50</Text>
              </View>
              
              {/* Meter background */}
              <View style={styles.meter}>
                {/* Perfect zone indicator */}
                <View style={styles.perfectZone} />
                
                {/* Needle */}
                <Animated.View 
                  style={[
                    styles.needle, 
                    { 
                      transform: [{ rotate: needleRotation.interpolate({
                        inputRange: [-45, 45],
                        outputRange: ['-45deg', '45deg']
                      })}]
                    }
                  ]} 
                />
              </View>
            </View>

            {/* Cents display */}
            <View style={styles.centsContainer}>
              <Text style={[styles.centsLabel, { color: status.color }]}>
                {cents > 0 ? '+' : ''}{cents} cents
              </Text>
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.text}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons 
              name={isListening ? "mic" : "mic-off"} 
              size={80} 
              color={colors.textTertiary} 
            />
            <Text style={styles.placeholderText}>
              {isListening ? 'Play a note...' : 'Tap the button to start tuning'}
            </Text>
          </View>
        )}
      </View>

      {/* Control button */}
      <TouchableOpacity
        style={[styles.button, isListening && styles.buttonActive]}
        onPress={toggleListening}
      >
        <Ionicons 
          name={isListening ? "stop" : "play"} 
          size={24} 
          color="#FFF" 
        />
        <Text style={styles.buttonText}>
          {isListening ? 'Stop Tuner' : 'Start Tuner'}
        </Text>
      </TouchableOpacity>

      {/* Info text */}
      <Text style={styles.infoText}>
        Perfect tuning is within ±5 cents
      </Text>
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 30,
  },
  displayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  note: {
    fontSize: 96,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  octave: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  frequency: {
    fontSize: 24,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  targetFreq: {
    fontSize: 14,
    color: colors.textTertiary,
    marginBottom: 30,
  },
  meterContainer: {
    width: '100%',
    marginVertical: 20,
  },
  scaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  scaleMark: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  centerMark: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  meter: {
    width: '100%',
    height: 60,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  perfectZone: {
    position: 'absolute',
    width: '10%',
    height: '100%',
    backgroundColor: colors.success ? colors.success + '20' : '#4CAF5020',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.success || '#4CAF50',
  },
  needle: {
    position: 'absolute',
    width: 4,
    height: 50,
    backgroundColor: colors.accent,
    borderRadius: 2,
    bottom: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  centsContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  centsLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: 20,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonActive: {
    backgroundColor: '#FF5252',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});
