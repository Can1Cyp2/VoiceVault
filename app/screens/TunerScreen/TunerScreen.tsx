// app/screens/TunerScreen/TunerScreen.tsx

import React, { useMemo, useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Dimensions, ScrollView } from "react-native";
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
import Svg, { Line, Circle, Text as SvgText, Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ViewMode = 'tuner' | 'graph' | 'piano';

interface PitchHistoryItem {
  frequency: number;
  note: string;
  octave: number;
  timestamp: number;
}

export default function TunerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [isListening, setIsListening] = useState(false);
  const [currentPitch, setCurrentPitch] = useState<PitchResult | null>(null);
  const [cents, setCents] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('tuner');
  const [pitchHistory, setPitchHistory] = useState<PitchHistoryItem[]>([]);
  
  const stopDetectionRef = useRef<(() => void) | null>(null);
  const needleRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const pianoScrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopDetectionRef.current) {
        stopDetectionRef.current();
        stopDetectionRef.current = null;
      }
    };
  }, []);

  // Add pitch to history
  useEffect(() => {
    if (currentPitch && isListening) {
      const newItem: PitchHistoryItem = {
        frequency: currentPitch.frequency,
        note: currentPitch.note,
        octave: currentPitch.octave,
        timestamp: Date.now(),
      };
      
      setPitchHistory(prev => {
        const updated = [...prev, newItem];
        // Keep only last 50 items
        return updated.slice(-50);
      });
    }
  }, [currentPitch, isListening]);

  // Auto-scroll piano to current note
  useEffect(() => {
    if (currentPitch && viewMode === 'piano' && pianoScrollRef.current) {
      const PIANO_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octaves = [2, 3, 4, 5, 6];
      
      // Find the index of the current note
      const octaveIndex = octaves.indexOf(currentPitch.octave);
      const noteIndex = PIANO_NOTES.indexOf(currentPitch.note);
      
      if (octaveIndex !== -1 && noteIndex !== -1) {
        // Calculate the position
        // Each octave container has 12 notes, white keys are ~45px wide
        const whiteKeyWidth = 45;
        const octaveWidth = whiteKeyWidth * 7; // 7 white keys per octave
        
        // Calculate white key position within octave
        const whiteKeysInScale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const baseNote = currentPitch.note.replace('#', '');
        const whiteKeyIndex = whiteKeysInScale.indexOf(baseNote);
        
        // Calculate scroll position
        const octaveOffset = octaveIndex * octaveWidth;
        const noteOffset = whiteKeyIndex >= 0 ? whiteKeyIndex * whiteKeyWidth : 0;
        const totalOffset = octaveOffset + noteOffset;
        
        // Center the note on screen (subtract half screen width)
        const centeredOffset = Math.max(0, totalOffset - (SCREEN_WIDTH / 2) + (whiteKeyWidth / 2));
        
        pianoScrollRef.current.scrollTo({ x: centeredOffset, animated: true });
      }
    }
  }, [currentPitch, viewMode]);

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
      setPitchHistory([]);
      
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

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / SCREEN_WIDTH);
    const modes: ViewMode[] = ['tuner', 'graph', 'piano'];
    if (modes[pageIndex] && modes[pageIndex] !== viewMode) {
      setViewMode(modes[pageIndex]);
    }
  };

  const scrollToView = (mode: ViewMode) => {
    const modes: ViewMode[] = ['tuner', 'graph', 'piano'];
    const index = modes.indexOf(mode);
    scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setViewMode(mode);
  };

  // Render Tuner View (Original)
  const renderTunerView = () => (
    <View style={[styles.viewContainer, { width: SCREEN_WIDTH }]}>
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
  );

  // Render Graph View
  const renderGraphView = () => {
    const graphWidth = SCREEN_WIDTH - 40;
    const graphHeight = 300;
    const padding = 40;
    
    if (!pitchHistory.length) {
      return (
        <View style={[styles.viewContainer, { width: SCREEN_WIDTH }]}>
          <View style={styles.placeholder}>
            <Ionicons name="bar-chart" size={80} color={colors.textTertiary} />
            <Text style={styles.placeholderText}>
              {isListening ? 'Waiting for notes...' : 'Start tuning to see frequency graph'}
            </Text>
          </View>
        </View>
      );
    }

    // Calculate min/max for scaling
    const frequencies = pitchHistory.map(item => item.frequency);
    const minFreq = Math.min(...frequencies);
    const maxFreq = Math.max(...frequencies);
    const freqRange = maxFreq - minFreq || 100;

    // Generate path for frequency line
    const points = pitchHistory.map((item, index) => {
      const x = padding + (index / (pitchHistory.length - 1)) * (graphWidth - 2 * padding);
      const y = graphHeight - padding - ((item.frequency - minFreq) / freqRange) * (graphHeight - 2 * padding);
      return { x, y, ...item };
    });

    const pathData = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    return (
      <View style={[styles.viewContainer, { width: SCREEN_WIDTH }]}>
        <Text style={styles.graphTitle}>Frequency Graph</Text>
        
        {/* Current Note Display */}
        {currentPitch && (
          <View style={styles.graphNoteSection}>
            <View style={styles.graphNoteContainer}>
              <Text style={styles.graphNote}>{currentPitch.note}</Text>
              <Text style={styles.graphOctave}>{currentPitch.octave}</Text>
            </View>
            <View style={styles.graphDetailsContainer}>
              <Text style={[styles.graphStatus, { color: status.color }]}>
                {status.text}
              </Text>
              <Text style={[styles.graphCents, { color: status.color }]}>
                {cents > 0 ? '+' : ''}{cents} cents
              </Text>
              <Text style={styles.graphFrequency}>
                {currentPitch.frequency.toFixed(2)} Hz
              </Text>
            </View>
          </View>
        )}
        
        <Svg width={graphWidth} height={graphHeight} style={styles.graph}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => {
            const y = padding + (i * (graphHeight - 2 * padding)) / 4;
            const freq = maxFreq - (i * freqRange) / 4;
            return (
              <React.Fragment key={i}>
                <Line
                  x1={padding}
                  y1={y}
                  x2={graphWidth - padding}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  opacity={0.3}
                />
                <SvgText
                  x={5}
                  y={y + 5}
                  fill={colors.textTertiary}
                  fontSize="10"
                >
                  {freq.toFixed(0)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Frequency line */}
          <Path
            d={pathData}
            stroke={colors.accent}
            strokeWidth="2"
            fill="none"
          />

          {/* Current point */}
          {points.length > 0 && (
            <Circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="5"
              fill={status.color}
            />
          )}

          {/* Note markers */}
          {points.filter((_, i) => i % 5 === 0).map((point, i) => (
            <SvgText
              key={i}
              x={point.x}
              y={graphHeight - 10}
              fill={colors.textSecondary}
              fontSize="10"
              textAnchor="middle"
            >
              {point.note}{point.octave}
            </SvgText>
          ))}
        </Svg>
      </View>
    );
  };

  // Render Piano View
  const renderPianoView = () => {
    const PIANO_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octaves = [2, 3, 4, 5, 6];
    
    const getPianoKeyColor = (note: string, octave: number) => {
      if (!currentPitch) return null;
      
      if (currentPitch.note === note && currentPitch.octave === octave) {
        const absCents = Math.abs(cents);
        if (absCents <= 5) return colors.success || '#4CAF50';
        if (absCents <= 15) return colors.warning || '#FFA500';
        return colors.danger || '#FF5252';
      }
      return null;
    };

    return (
      <View style={[styles.viewContainer, { width: SCREEN_WIDTH }]}>
        {currentPitch ? (
          <>
            <Text style={styles.pianoTitle}>Piano Tuner</Text>
            <View style={styles.pianoInfoContainer}>
              <Text style={styles.pianoCurrentNote}>
                {currentPitch.note}{currentPitch.octave}
              </Text>
              <Text style={[styles.pianoStatus, { color: status.color }]}>
                {status.text}
              </Text>
              <Text style={styles.pianoCents}>
                {cents > 0 ? '+' : ''}{cents} cents
              </Text>
            </View>

            <ScrollView 
              ref={pianoScrollRef}
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.pianoScrollContainer}
              contentContainerStyle={styles.pianoScrollContent}
            >
              {octaves.map(octave => (
                <View key={octave} style={styles.octaveContainer}>
                  {PIANO_NOTES.map((note, index) => {
                    const isBlackKey = note.includes('#');
                    const keyColor = getPianoKeyColor(note, octave);
                    
                    return (
                      <View
                        key={`${note}${octave}`}
                        style={[
                          styles.pianoKey,
                          isBlackKey ? styles.blackKey : styles.whiteKey,
                          keyColor && { backgroundColor: keyColor }
                        ]}
                      >
                        {!isBlackKey && (
                          <Text style={[
                            styles.pianoKeyLabel,
                            keyColor && { color: '#FFF', fontWeight: 'bold' }
                          ]}>
                            {note}{octave}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {/* Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.success || '#4CAF50' }]} />
                <Text style={styles.legendText}>Perfect (±5¢)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.warning || '#FFA500' }]} />
                <Text style={styles.legendText}>Close (±15¢)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: colors.danger || '#FF5252' }]} />
                <Text style={styles.legendText}>Off (&gt;15¢)</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="musical-notes" size={80} color={colors.textTertiary} />
            <Text style={styles.placeholderText}>
              {isListening ? 'Play a note...' : 'Start tuning to see piano display'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const status = getTuningStatus();
  const targetFreq = currentPitch ? getNoteFrequency(currentPitch.note, currentPitch.octave) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chromatic Tuner</Text>
      
      {/* View mode indicators */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'tuner' && styles.viewModeButtonActive]}
          onPress={() => scrollToView('tuner')}
        >
          <Ionicons 
            name="speedometer" 
            size={20} 
            color={viewMode === 'tuner' ? colors.accent : colors.textTertiary} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === 'tuner' && styles.viewModeTextActive
          ]}>
            Tuner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'graph' && styles.viewModeButtonActive]}
          onPress={() => scrollToView('graph')}
        >
          <Ionicons 
            name="bar-chart" 
            size={20} 
            color={viewMode === 'graph' ? colors.accent : colors.textTertiary} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === 'graph' && styles.viewModeTextActive
          ]}>
            Graph
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.viewModeButton, viewMode === 'piano' && styles.viewModeButtonActive]}
          onPress={() => scrollToView('piano')}
        >
          <Ionicons 
            name="musical-notes" 
            size={20} 
            color={viewMode === 'piano' ? colors.accent : colors.textTertiary} 
          />
          <Text style={[
            styles.viewModeText,
            viewMode === 'piano' && styles.viewModeTextActive
          ]}>
            Piano
          </Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable display area */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {renderTunerView()}
        {renderGraphView()}
        {renderPianoView()}
      </ScrollView>

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
        {viewMode === 'tuner' && 'Perfect tuning is within ±5 cents'}
        {viewMode === 'graph' && 'Swipe to see different views'}
        {viewMode === 'piano' && 'Keys light up based on tuning accuracy'}
      </Text>
    </View>
  );
}

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  viewModeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 10,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    gap: 5,
  },
  viewModeButtonActive: {
    backgroundColor: colors.accent + '20',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  viewModeText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  viewModeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  viewContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
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
  // Graph view styles
  graphTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  graphNoteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 20,
  },
  graphNoteContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  graphNote: {
    fontSize: 72,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  graphOctave: {
    fontSize: 36,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  graphDetailsContainer: {
    justifyContent: 'center',
    gap: 2,
  },
  graphStatus: {
    fontSize: 18,
    fontWeight: '700',
  },
  graphCents: {
    fontSize: 16,
    fontWeight: '600',
  },
  graphFrequency: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  currentNoteDisplay: {
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  currentNoteText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  graph: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    marginTop: 10,
  },
  // Piano view styles
  pianoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  pianoInfoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pianoCurrentNote: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pianoStatus: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 5,
  },
  pianoCents: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 3,
  },
  pianoScrollContainer: {
    maxHeight: 200,
  },
  pianoScrollContent: {
    paddingVertical: 10,
  },
  octaveContainer: {
    flexDirection: 'row',
    marginHorizontal: 2,
  },
  pianoKey: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  whiteKey: {
    width: 45,
    height: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    marginHorizontal: 1,
    paddingBottom: 10,
  },
  blackKey: {
    width: 30,
    height: 120,
    backgroundColor: '#000000',
    borderRadius: 4,
    marginLeft: -16,
    marginRight: -16,
    zIndex: 1,
  },
  pianoKeyLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
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
    marginHorizontal: 20,
    marginBottom: 10,
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
    marginHorizontal: 20,
    fontStyle: 'italic',
  },
});
