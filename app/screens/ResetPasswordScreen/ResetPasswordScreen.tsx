
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { supabase } from '../../util/supabase';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import type { NavigationProp } from '@react-navigation/native';

const ResetPasswordScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute();

  useEffect(() => {
    // The deep link will pass the refresh token in the URL, which Supabase handles automatically.
    // We can check for an error description in the route params, which may be passed by Supabase.
    const { error_description } = route.params as { error_description?: string };
    if (error_description) {
      Alert.alert('Error', error_description);
    }
  }, [route.params]);

  const handlePasswordReset = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.update({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Your password has been updated successfully.');
      navigation.navigate('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <TextInput
        style={styles.input}
        placeholder="New Password"
        placeholderTextColor={colors.textPlaceholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        placeholderTextColor={colors.textPlaceholder}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <Button title={loading ? 'Resetting...' : 'Reset Password'} onPress={handlePasswordReset} disabled={loading} />
    </View>
  );
};

const createStyles = (colors: typeof import('../../styles/theme').LightColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  input: {
    height: 40,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: 5,
  },
});

export default ResetPasswordScreen;
