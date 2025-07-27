import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { signInWithCredential, PhoneAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { firebaseConfig } from '../lib/firebase'; // تأكد أنك صدّرت config من نفس الملف
import { useRouter } from 'expo-router';

export default function LoginWithPhone() {
  const router = useRouter();
  const recaptchaVerifier = useRef(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);

  const sendVerification = async () => {
    if (!phoneNumber.startsWith('+966')) {
      Alert.alert('Invalid Number', 'Please enter phone number in international format (e.g., +966...)');
      return;
    }

    try {
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber(phoneNumber, recaptchaVerifier.current as any);
      setVerificationId(id);
      Alert.alert('Code Sent', 'A verification code has been sent to your phone.');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message);
    }
  };

  const confirmCode = async () => {
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
      await signInWithCredential(auth, credential);
      router.replace('/(tabs)/history');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Invalid Code', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseConfig}
      />

      <Text style={styles.title}>Login with Phone</Text>

      <TextInput
        placeholder="+9665XXXXXXX"
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        style={styles.input}
      />
      <Button title="Send Code" onPress={sendVerification} />

      {verificationId !== '' && (
        <>
          <TextInput
            placeholder="Enter verification code"
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            style={styles.input}
          />
          <Button title="Confirm Code" onPress={confirmCode} />
        </>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
});
