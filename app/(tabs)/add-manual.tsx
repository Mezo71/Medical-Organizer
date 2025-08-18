// app/AddManualTest.tsx


import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, TextInput,
  Image, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './../lib/firebase';
import { getAuth } from 'firebase/auth';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

import {
  getRangeStatus,
  getUnit,
  getNote,
  resolveKey,
  fitToRangeMagnitude,
  testDictionary,
} from '../../testDictionary';
import { extractTextFromImage } from '../../utils/ocr';

/* ===========================
   Helpers
   =========================== */

function normalizeOcr(result: any): string[] {
  if (!result) return [];
  if (Array.isArray(result)) return result.map(String);
  if (typeof result === 'object' && Array.isArray((result as any).texts)) return (result as any).texts.map(String);
  if (typeof result === 'string') return [result];
  return [];
}

const DICT_KEYS_UPPER = new Set(Object.keys(testDictionary).map(k => k.toUpperCase()));

function canonicalizeFromDictionary(raw: string): string | null {
  if (!raw) return null;
  const k = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  if (!/[A-Z]/.test(k)) return null;
  if (DICT_KEYS_UPPER.has(k)) return k;
  for (const dictKey of DICT_KEYS_UPPER) {
    if (k.includes(dictKey)) return dictKey;
  }
  for (const dictKey of DICT_KEYS_UPPER) {
    if (dictKey.includes(k) && k.length >= 3) return dictKey;
  }
  return null;
}

function extractValuesUsingDictionary(textJoined: string, linesUpper: string[]): Record<string, string> {
  const out: Record<string, string> = {};

  const CBC_REGEXES: RegExp[] = [
    /\b(RBC|WBC|HGB|HB|HCT|MCV|MCH|MCHC|RDW|PLT|PLATELETS?|NEUT|NEUTROPHILS|SEGMENTED NEUTROPHILS|LYMPH|LYMPHOCYTES|MONO|MONOCYTES|EOS|EOSINOPHILS|BASO|BASOPHILS)\b[^\d]{0,18}([0-9]+(?:\.[0-9]+)?)/gi,
  ];

  for (const re of CBC_REGEXES) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(textJoined)) !== null) {
      const canon = canonicalizeFromDictionary(m[1]);
      const val = m[2];
      if (canon && !out[canon]) out[canon] = val;
    }
  }

  for (const ln of linesUpper) {
    for (const re of CBC_REGEXES) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(ln)) !== null) {
        const canon = canonicalizeFromDictionary(m[1]);
        const val = m[2];
        if (canon && !out[canon]) out[canon] = val;
      }
    }
  }

  const GENERIC = /([A-Z][A-Z0-9]{1,15})\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/g;
  let g: RegExpExecArray | null;
  while ((g = GENERIC.exec(textJoined)) !== null) {
    const canon = canonicalizeFromDictionary(g[1]);
    const val = g[2];
    if (canon && !out[canon]) out[canon] = val;
  }

  for (const k of Object.keys(out)) {
    if (!DICT_KEYS_UPPER.has(k)) delete out[k];
  }
  return out;
}

/* ---------- Smart suggestion helpers to avoid defaulting to CBC ---------- */

function countOccurrences(textUpper: string, key: string): number {
  const k = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const re = new RegExp(`\\b${k}\\b`, 'g');
  return (textUpper.match(re) || []).length;
}

function chooseBestSuggestion(
  foundKeys: string[],
  extracted: Record<string, string>,
  textJoinedUpper: string
): { name: string; category?: string } | null {
  const CBC_CORE = ['RBC','WBC','HGB','HCT','MCV','MCH','MCHC','RDW','PLT'];

  const explicitCBC = /\bCBC\b/.test(textJoinedUpper);
  const coreHits = CBC_CORE.filter(k => extracted[k]).length;

  if (explicitCBC || coreHits >= 4) {
    return { name: 'CBC', category: 'Blood' };
  }

  let best: string | null = null;
  let bestScore = -Infinity;

  for (const key of foundKeys) {
    let score = 0;
    if (extracted[key]) score += 3;
    score += countOccurrences(textJoinedUpper, key);
    if (key.length >= 4) score += 0.5;

    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  return best ? { name: best } : null;
}

/* helper: was this test detected in image text? */
function isDetected(key: string, suggestions: string[]) {
  const up = key.toUpperCase();
  return suggestions.some(s => s.toUpperCase() === up);
}

/* ===========================
   Component
   =========================== */

export default function AddManualTest() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [selectedCategory, setSelectedCategory] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [testDate, setTestDate] = useState(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [ocrResult, setOcrResult] = useState<{ name: string, category: string, description: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [extractedValues, setExtractedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const categories = ['Blood', 'Urine', 'X-Ray', 'MRI', 'Other'];

  // ---------- gallery & camera ----------
  const processImage = async (uri: string) => {
    setImageUri(uri);
    setLoading(true);
    try {
      const rawOcr = await extractTextFromImage(uri);
      const ocrTexts: string[] = normalizeOcr(rawOcr);

      const linesUpper = ocrTexts.map(t => String(t).toUpperCase());
      const textJoined = linesUpper.join(' ').replace(/\s+/g, ' ').trim();

      // detect keys present in text (UPPER keys)
      const dictKeysUpper = Array.from(DICT_KEYS_UPPER);
      const foundKeys = dictKeysUpper.filter(k => textJoined.includes(k));
      setSuggestions(foundKeys);

      // extract values and auto-fix decimals as expected 
      const values = extractValuesUsingDictionary(textJoined, linesUpper);
      const corrected: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        const num = parseFloat(String(v).replace(',', '.'));
        const fixed = fitToRangeMagnitude(k, num);
        corrected[k] = isFinite(fixed) ? String(Math.round(fixed * 100) / 100) : String(v);
      }
      setExtractedValues(corrected);

      // Suggestion for test name
      const choice = chooseBestSuggestion(foundKeys, corrected, textJoined);
      if (choice) {
        setTestName(choice.name);
        if (choice.category) setSelectedCategory(choice.category);
        setOcrResult(choice.name === 'CBC'
          ? { name: 'CBC', category: 'Blood', description: 'Complete blood count.' }
          : null
        );
      } else if (foundKeys.length > 0) {
        setTestName(foundKeys[0]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('OCR Error', 'Failed to extract values from image.');
    } finally {
      setLoading(false);
    }
  };

  // ---------- Gallery ----------
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'You must allow gallery access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length) {
      await processImage(result.assets[0].uri);
    }
  };

  // ---------- Camera ----------
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'You must allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets?.length) {
      await processImage(result.assets[0].uri);
    }
  };

  const uploadImageToMongoDB = async (uri: string) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'image.jpg';
      const fileType = filename.split('.').pop();

      formData.append('image', {
        uri,
        name: filename,
        type: `image/${fileType}`,
      } as any);

      const response = await fetch('http://192.168.1.46:5000/upload', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = await response.json();
      return `http://192.168.1.46:5000/image/${data.imageId}`;
    } catch (error) {
      console.error('Image upload failed:', error);
      return null;
    }
  };

  const handleAddTest = async () => {
    if (!testName || !selectedCategory || !testDate || !user?.uid) {
      Alert.alert('Missing info', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      let uploadedImageUrl: string | null = null;
      if (imageUri) {
        uploadedImageUrl = await uploadImageToMongoDB(imageUri);
        if (!uploadedImageUrl) {
          Alert.alert('Upload Error', 'Failed to upload image.');
          setLoading(false);
          return;
        }
      }

      // Build status/unit/note maps
      const resultStatusMap: Record<string, string> = {};
      const unitsMap: Record<string, string> = {};
      const notesMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(extractedValues)) {
        const num = parseFloat(String(v).replace(',', '.'));
        const status = getRangeStatus(k, isFinite(num) ? num : NaN, { borderlinePct: 5 });
        const unit = getUnit(k);
        const note = getNote(k, status);
        resultStatusMap[k] = status;
        if (unit) unitsMap[k] = unit;
        if (note) notesMap[k] = note;
      }

      await addDoc(collection(db, 'medicalTests'), {
        userId: user.uid,
        name: testName,
        category: selectedCategory,
        date: testDate.toISOString().split('T')[0],
        imageUri: uploadedImageUrl,
        createdAt: new Date().toISOString(),
        suggestions,
        extractedValues,

        // new maps:
        resultStatusMap,
        unitsMap,
        notesMap,
      });

      Alert.alert('Saved ✅', 'Test saved successfully!');
      setTestName('');
      setSelectedCategory('');
      setTestDate(new Date());
      setImageUri(null);
      setExtractedValues({});
      setSuggestions([]);
      setOcrResult(null);
    } catch (error) {
      console.error('Error saving test:', error);
      Alert.alert('Save Error', 'Failed to save the test.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Add Medical Test</Text>

      <Text style={styles.label}>Test Name</Text>
      <TextInput
        style={styles.input}
        value={testName}
        onChangeText={setTestName}
        placeholder="Enter test name"
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((category, index) => (
          <Pressable
            key={index}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonSelected
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextSelected
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Date</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
        <Text>{testDate.toISOString().split('T')[0]}</Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={testDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setTestDate(selectedDate);
          }}
        />
      )}

      {/* Image controls: Gallery + Camera */}
      <View style={styles.imageButtonsRow}>
        <Pressable style={[styles.imageButton, { backgroundColor: '#2d6cdf' }]} onPress={pickImage}>
          <Text style={styles.imageButtonText}>{imageUri ? 'Change Image' : 'Select Image'}</Text>
        </Pressable>
        <Pressable style={[styles.imageButton, { backgroundColor: '#1b929aff' }]} onPress={takePhoto}>
          <Text style={styles.imageButtonText}>📷 Camera</Text>
        </Pressable>
      </View>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}

      {loading && <ActivityIndicator size="large" style={{ marginVertical: 8 }} />}

      {Object.keys(extractedValues).length > 0 && (
        <View style={styles.extractedBox}>
          <Text style={styles.extractedTitle}>🧪 Extracted Test Results:</Text>

          {Object.entries(extractedValues).map(([key, value]) => {
            const num = parseFloat(String(value).replace(',', '.'));
            const status = getRangeStatus(key, isFinite(num) ? num : NaN, { borderlinePct: 5 });
            const unit = getUnit(key);
            const note = getNote(key, status);
            const description = (testDictionary as any)[key] as string | undefined; // description from dictionary
            const detected = isDetected(key, suggestions);

            return (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={{ fontWeight: '600' }}>{key} Result</Text>
                <TextInput
                  style={styles.extractedInput}
                  value={String(value)}
                  onChangeText={(text) => setExtractedValues((prev) => ({ ...prev, [key]: text }))}
                  placeholder="Enter result"
                  keyboardType="numeric"
                />
                <View style={[styles.badge, badgeColor(status)]}>
                  <Text style={styles.badgeText}>{status}</Text>
                </View>
                {unit ? <Text style={{ color: '#666', fontSize: 12 }}>Unit: {unit}</Text> : null}

                {description ? (
                  <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                    {description}
                  </Text>
                ) : null}

                {detected ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: '#e5e7eb',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10,
                      marginTop: 6,
                    }}
                  >
                    <Text style={{ color: '#374151', fontSize: 11 }}>Detected in image</Text>
                  </View>
                ) : null}

                {note ? (
                  <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
                    {note}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {/* Suggestions with no values yet */}
      {suggestions.filter(s => !extractedValues[s]).length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Other suggestions:</Text>
          {suggestions
            .filter(s => !extractedValues[s])
            .map((word, index) => (
              <Pressable
                key={index}
                onPress={() => setTestName(word)}
                style={{ backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 6 }}
              >
                <Text style={{ fontWeight: '600' }}>{word}</Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  {(testDictionary as any)[word] || 'No info available'}
                </Text>
              </Pressable>
            ))}
        </View>
      )}

      {ocrResult && (
        <View style={styles.ocrBox}>
          <Text style={styles.ocrTitle}>🧠 OCR Suggestion:</Text>
          <Text>Test: {ocrResult.name}</Text>
          <Text style={styles.ocrDescription}>{ocrResult.description}</Text>
          <Text>Category: {ocrResult.category}</Text>
          <Pressable
            style={styles.useSuggestionButton}
            onPress={() => {
              setTestName(ocrResult.name);
              setSelectedCategory(ocrResult.category);
              setOcrResult(null);
            }}
          >
            <Text style={styles.useSuggestionText}>Use Suggestion</Text>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.submitButton} onPress={handleAddTest} disabled={loading}>
        <Text style={styles.submitText}>Save Test</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 20 },
  backButton: {
    marginBottom: 15, alignSelf: 'flex-start', backgroundColor: '#ccc',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8
  },
  backButtonText: { color: '#333', fontWeight: 'bold' },

  categoryScroll: { marginBottom: 20, flexDirection: 'row' },
  categoryButton: {
    paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#f0f0f0',
    borderRadius: 20, marginRight: 10,
  },
  categoryButtonSelected: { backgroundColor: '#007AFF' },
  categoryText: { color: '#555', fontWeight: '500' },
  categoryTextSelected: { color: '#fff' },

  dateButton: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 16 },

  imageButtonsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  imageButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  imageButtonText: { color: '#fff', fontWeight: '700' },

  previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },

  submitButton: { backgroundColor: '#1e90ff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontWeight: 'bold' },

  ocrBox: {
    backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 20,
    borderWidth: 1, borderColor: '#ccc',
  },
  ocrTitle: { fontWeight: 'bold', marginBottom: 6 },
  ocrDescription: { fontStyle: 'italic', color: '#444', marginBottom: 6 },
  useSuggestionButton: {
    marginTop: 8, backgroundColor: '#1e90ff', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 6, alignSelf: 'flex-start',
  },
  useSuggestionText: { color: '#fff', fontWeight: '600' },

  extractedBox: { backgroundColor: '#f1f8ff', padding: 12, borderRadius: 8, marginBottom: 16 },
  extractedTitle: { fontWeight: 'bold', color: '#007AFF', marginBottom: 6 },
  extractedInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginTop: 4 },

  // badge
  badge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, marginTop: 6 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});

// badge colors 
function badgeColor(status: string) {
  if (status === 'Normal') return { backgroundColor: '#16a34a' };            // green
  if (status === 'Low')    return { backgroundColor: '#2563eb' };            // blue
  if (status === 'High')   return { backgroundColor: '#dc2626' };            // red
  if (status === 'Borderline Low' || status === 'Borderline High')
    return { backgroundColor: '#eab308' };                                   // yellow
  return { backgroundColor: '#6b7280' };                                     // gray (Unknown)
}
