import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';


export default function EditTest() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [testType, setTestType] = useState('');
  const [notes, setNotes] = useState('');
  const [testDate, setTestDate] = useState('');

  useEffect(() => {
    const load = async () => {
      const docRef = doc(db, 'medicalTests', id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setTestType(data.testType);
        setTestDate(data.testDate);
        setNotes(data.notes || '');
      } else {
        Alert.alert('Not found');
        router.replace('/history');
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    try {
      const docRef = doc(db, 'medicalTests', id as string);
      await updateDoc(docRef, {
        testType,
        testDate,
        notes,
      });
      Alert.alert('Success', 'Test updated successfully.');
      router.replace('/history');
    } catch (e) {
      Alert.alert('Error', 'Failed to update test.');
    }
  };

  const handleDelete = async () => {
    try {
      const docRef = doc(db, 'medicalTests', id as string);
      await deleteDoc(docRef);
      Alert.alert('Deleted', 'Test deleted successfully.');
      router.replace('/history');
    } catch (e) {
      Alert.alert('Error', 'Failed to delete test.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Edit Medical Test</Text>

      <TextInput
        style={styles.input}
        placeholder="Test Type"
        value={testType}
        onChangeText={setTestType}
      />
      <TextInput
        style={styles.input}
        placeholder="Date (YYYY-MM-DD)"
        value={testDate}
        onChangeText={setTestDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
      />

      <Button title="Save Changes" onPress={handleSave} color="#007AFF" />
      <View style={{ marginTop: 10 }}>
        <Button title="Delete Test" onPress={handleDelete} color="#FF3B30" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    marginVertical: 8,
    borderRadius: 5,
  },
  backButton: {
    marginBottom: 10,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
