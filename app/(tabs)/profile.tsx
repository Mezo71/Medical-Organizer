import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { getAuth } from 'firebase/auth';
import { db } from '../lib/firebase'; // ✅ تأكد من المسار حسب مشروعك
import { doc, getDoc, setDoc } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

export default function Profile() {
  const auth = getAuth();
  const user = auth.currentUser;
  const userId = user?.uid;
  const router = useRouter();

  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [medicalIssues, setMedicalIssues] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      const docRef = doc(db, 'userProfiles', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setName(data.name || '');
        setDob(data.dob ? new Date(data.dob) : null);
        setHeight(data.height || '');
        setWeight(data.weight || '');
        setMedicalIssues(data.medicalIssues || '');
      }
    };

    fetchProfile();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;

    const data = {
      name,
      dob: dob?.toISOString().split('T')[0] || '',
      height,
      weight,
      medicalIssues
    };

    await setDoc(doc(db, 'userProfiles', userId), data);
    alert('Profile saved successfully!');
  };

  return (
    <View style={styles.container}>
      {/* زر الرجوع */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Edit Profile</Text>

      <TextInput
        placeholder="Name"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <Pressable onPress={() => setShowPicker(true)} style={styles.input}>
        <Text>{dob ? dob.toDateString() : 'Select Date of Birth'}</Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={dob || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowPicker(false);
            if (selectedDate) setDob(selectedDate);
          }}
        />
      )}

      <TextInput
        placeholder="Height (cm)"
        style={styles.input}
        keyboardType="numeric"
        value={height}
        onChangeText={setHeight}
      />

      <TextInput
        placeholder="Weight (kg)"
        style={styles.input}
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />

      <TextInput
        placeholder="Medical Issues"
        style={[styles.input, { height: 100 }]}
        value={medicalIssues}
        onChangeText={setMedicalIssues}
        multiline
      />

      <Pressable onPress={handleSave} style={styles.saveButton}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#hff' },
  backButton: {
    marginBottom: 15,
    alignSelf: 'flex-start',
    backgroundColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  backButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  input: {
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 10,
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#007bff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  }
});
