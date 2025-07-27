import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Image, Alert, Platform, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage } from '../../utils/ocr';
import { testDictionary } from '../../testDictionary';

export default function EditTest() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [extractedValues, setExtractedValues] = useState<Record<string, string>>({});

  const categories = ['Blood', 'Urine', 'X-Ray', 'MRI', 'Other'];

  const getCategoryFromName = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper.includes('A1C') || upper.includes('GLU') || upper.includes('GLUCOSE')) return 'Blood';
    if (upper.includes('TSH')) return 'Thyroid';
    if (upper.includes('LFT')) return 'Liver';
    if (upper.includes('KFT') || upper.includes('CREATININE')) return 'Kidney';
    if (upper.includes('VITAMIN')) return 'Vitamin';
    return 'Other';
  };

  const getUnit = (label: string): string => {
    const upper = label.toUpperCase();
    if (upper.includes('A1C')) return '%';
    if (upper.includes('GLU') || upper.includes('GLUCOSE') || upper.includes('VITAMIN') || upper.includes('IRON')) return 'mg/dL';
    if (upper.includes('TSH')) return 'mIU/L';
    if (upper.includes('CREATININE')) return 'mg/dL';
    return '';
  };

  useEffect(() => {
    const fetchTest = async () => {
      if (!id) return;
      const docRef = doc(db, 'medicalTests', String(id));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTestName(data.name || '');
        setCategory(data.category || '');
        setDate(new Date(data.date));
        setImageUri(data.imageUri || null);
        setExtractedValues(data.extractedValues || {});
      } else {
        Alert.alert('Error', 'Test not found.');
        router.back();
      }
    };

    fetchTest();
  }, [id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'You must allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri);

      const texts = await extractTextFromImage(uri);
      const extracted: Record<string, string> = { ...extractedValues }; // منع التكرار

      texts.forEach((text) => {
        const match = text.match(/([A-Z0-9]+)\s*=?\s*([0-9.]+)/);
        if (match) {
          const key = match[1];
          const value = match[2];
          if (!extracted[key]) {
            extracted[key] = value;
          }
        }
      });

      setExtractedValues(extracted);
    }
  };

  const handleSave = async () => {
    if (!testName || !category || !date) {
      Alert.alert('Missing Info', 'Please complete all required fields.');
      return;
    }

    try {
      await updateDoc(doc(db, 'medicalTests', String(id)), {
        name: testName,
        category,
        date: date.toISOString().split('T')[0],
        imageUri,
        extractedValues,
        updatedAt: new Date().toISOString(),
      });

      Alert.alert('Success', 'Test updated successfully!');
      router.back();
    } catch (error) {
      console.error('Save Error:', error);
      Alert.alert('Error', 'Failed to update test.');
    }
  };
  

  return (
    
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={{ marginBottom: 10 }}>
  <Text style={{ color: '#007AFF', fontSize: 16 }}>← Back</Text>
</Pressable>

      <Text style={styles.title}>Edit Medical Test</Text>

      <Text style={styles.label}>Test Name</Text>
      <TextInput
        style={styles.input}
        value={testName}
        onChangeText={(text) => {
          setTestName(text);
          setCategory(getCategoryFromName(text)); // تحليل ذكي للاسم
        }}
        placeholder="Enter test name"
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal style={styles.categoryScroll}>
        {categories.map((cat, index) => (
          <Pressable
            key={index}
            style={[
              styles.categoryButton,
              category === cat && styles.categoryButtonSelected
            ]}
            onPress={() => setCategory(cat)}
          >
            <Text
              style={[
                styles.categoryText,
                category === cat && styles.categoryTextSelected
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text>{date.toISOString().split('T')[0]}</Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      <Pressable style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>
          {imageUri ? 'Change Image' : 'Upload Image'}
        </Text>
      </Pressable>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}

      {Object.keys(extractedValues).length > 0 && (
        <View style={styles.extractedBox}>
          <Text style={styles.sectionTitle}>🧪 Extracted Results</Text>
          {Object.entries(extractedValues).map(([key, value]) => (
            <View key={key} style={styles.resultGroup}>
              <Text style={styles.resultLabel}>{key} Result</Text>
              <TextInput
                style={styles.resultInput}
                value={String(value)}
                keyboardType="numeric"
                onChangeText={(text) =>
                  setExtractedValues((prev) => ({
                    ...prev,
                    [key]: text
                  }))
                }
              />
              <Text style={styles.unitText}>{getUnit(key)}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, marginBottom: 20,
  },
  dateButton: {
    padding: 12, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, marginBottom: 20,
  },
  imageButton: {
    backgroundColor: '#eee', padding: 12,
    borderRadius: 8, alignItems: 'center', marginBottom: 10,
  },
  imageButtonText: { fontWeight: '500', color: '#007AFF' },
  previewImage: {
    width: '100%', height: 200,
    borderRadius: 8, marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#1e90ff', padding: 15,
    borderRadius: 8, alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff', fontWeight: 'bold',
  },
  categoryScroll: {
    marginBottom: 20,
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    color: '#555',
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  extractedBox: {
    backgroundColor: '#f5faff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  resultGroup: {
    marginBottom: 12,
  },
  resultLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  resultInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  unitText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 4,
  },
});
