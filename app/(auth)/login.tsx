import React from 'react';
import { View, Button, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

export default function LoginPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>

      

      <Button title="Login with Email" onPress={() => router.push('/loginWithEmail')} />
      <View style={styles.spacing} />

      <Button title="Login with Phone" onPress={() => router.push('/loginWithPhone')} />
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
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  spacing: {
    height: 16,
  },
});
