// app/components/ToolsModal/ToolsModal.tsx

import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface ToolsModalProps {
  visible: boolean;
  onClose: () => void;
  onMetronomePress: () => void;
  onTunerPress: () => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({
  visible,
  onClose,
  onMetronomePress,
  onTunerPress,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tools</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Tools Buttons */}
          <View style={styles.buttonContainer}>
            {/* Metronome Button */}
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => {
                onMetronomePress();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.emoji}>🎵</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.toolTitle}>Metronome</Text>
                <Text style={styles.toolDescription}>Keep time and practice rhythm</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Tuner Button */}
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => {
                onTunerPress();
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.emoji}>🎸</Text>
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.toolTitle}>Tuner</Text>
                <Text style={styles.toolDescription}>Tune your instrument or voice</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '85%',
      maxWidth: 400,
      backgroundColor: colors.backgroundCard,
      borderRadius: 20,
      padding: 0,
      shadowColor: colors.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 20,
    },
    buttonContainer: {
      padding: 20,
      gap: 12,
    },
    toolButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    disabledButton: {
      opacity: 0.6,
    },
    iconContainer: {
      width: 50,
      height: 50,
      backgroundColor: colors.backgroundTertiary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emoji: {
      fontSize: 28,
    },
    textContainer: {
      flex: 1,
    },
    toolTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    toolDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    comingSoon: {
      fontSize: 14,
      color: colors.textTertiary,
      fontStyle: 'italic',
    },
  });
