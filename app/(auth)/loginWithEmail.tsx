// app/loginWithEmail.tsx
import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'expo-router';

export default function LoginWithEmail() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(tabs)/history');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Failed', error?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || !email || !password;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with Email</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          returnKeyType="next"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          returnKeyType="done"
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          isDisabled && styles.buttonDisabled,
          pressed && !isDisabled && styles.buttonPressed,
        ]}
        onPress={handleLogin}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Log In</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        Tip: Use your registered email and password. If you forgot your password,
        reset it from the email login page.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.secondaryButtonPressed,
        ]}
        onPress={() => router.push('/signup')}
      >
        <Text style={styles.secondaryButtonText}>Create an Account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 36,
    color: '#1f2937',
  },
  fieldGroup: { marginBottom: 14 },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1E90FF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hint: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 14,
    fontSize: 12,
  },

  //Sign up button
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    color: '#1E90FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
