import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Image, Alert, Platform, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage } from '../../utils/ocr';

// === bring  metadata from  dictionary ===
import {
  testDictionary,
  resolveKey,
  getUnit,
  testRanges,
  getRangeStatus,
  getNote,
  fitToRangeMagnitude,
  RangeStatus,
} from '../../testDictionary';

type ExtractedMap = Record<string, string>;

const CATEGORIES = ['Blood', 'Urine', 'X-Ray', 'MRI', 'Other'];

export default function EditTest() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [extractedValues, setExtractedValues] = useState<ExtractedMap>({});
  const [saving, setSaving] = useState(false);

  // ---------- helpers ----------
  const getCategoryFromName = (name: string): string => {
    const upper = name.toUpperCase();
    if (upper.includes('CBC') || upper.includes('HGB') || upper.includes('GLU') || upper.includes('A1C')) return 'Blood';
    if (upper.includes('TSH') || upper.includes('THY')) return 'Blood';
    if (upper.includes('CREAT') || upper.includes('KFT') || upper.includes('KIDNEY')) return 'Blood';
    return 'Other';
  };

  const numeric = (s: any): number | null => {
    if (s == null) return null;
    const n = Number(String(s).replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  // Make a normalized list of results with metadata (name, unit, range, status, note)
  const rows = useMemo(() => {
    const out: Array<{
      originalKey: string;
      canonical: string;
      displayName: string;
      unit: string;
      valueRaw: string;
      valueNum: number | null;
      valueFixed: number | null;
      range?: { min: number; max: number; unit: string };
      status: RangeStatus;
      note: string | null;
    }> = [];

    for (const [k, v] of Object.entries(extractedValues)) {
      const canonical = resolveKey(k) ?? k.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const displayName = testDictionary[canonical] ?? k;
      const unit = getUnit(canonical);
      const range = testRanges[canonical];

      const valueNum = numeric(v);
      // correct OCR decimal if we know the range
      const valueFixed = valueNum != null && range ? fitToRangeMagnitude(canonical, valueNum) : valueNum;

      const status =
        valueFixed != null && range
          ? getRangeStatus(canonical, valueFixed, { borderlinePct: 5 })
          : 'Unknown';

      const note = getNote(canonical, status);

      out.push({
        originalKey: k,
        canonical,
        displayName,
        unit,
        valueRaw: String(v),
        valueNum,
        valueFixed,
        range,
        status,
        note,
      });
    }

    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return out;
  }, [extractedValues]);

  const statusColor = (s: RangeStatus): string => {
    switch (s) {
      case 'Low': return '#e53935';
      case 'Borderline Low': return '#fb8c00';
      case 'Normal': return '#43a047';
      case 'Borderline High': return '#fb8c00';
      case 'High': return '#e53935';
      default: return '#9e9e9e';
    }
  };

  useEffect(() => {
    const fetchTest = async () => {
      if (!id) return;
      const docRef = doc(db, 'medicalTests', String(id));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        setTestName(data.name || '');
        setCategory(data.category || '');
        setDate(data.date ? new Date(data.date) : new Date());
        setImageUri(data.imageUri || null);
        setExtractedValues(data.extractedValues || {});
      } else {
        Alert.alert('Error', 'Test not found.');
        router.back();
      }
    };

    fetchTest();
  }, [id]);

  // ---------- actions ----------
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

      try {
        const texts = await extractTextFromImage(uri);
        const next: Record<string, string> = { ...extractedValues };

        texts.forEach((text) => {
          // Loose pattern like: "Hemoglobin 10.0 g/dL" or "HGB = 10.0"
          const m = text.match(/([A-Za-z0-9%\-\/\s()]+?)\s*[:=]?\s*([0-9.]+)\b/);
          if (m) {
            const rawKey = m[1].trim();
            const value = m[2];
            const canonical = resolveKey(rawKey) ?? rawKey.toUpperCase().replace(/[^A-Z0-9]/g, '');
            // canonical key in storage to unify later usage
            if (!next[canonical]) next[canonical] = value;
          }
        });

        setExtractedValues(next);
      } catch (e) {
        console.error('OCR error', e);
        Alert.alert('OCR Error', 'Failed to read the image.');
      }
    }
  };

  const handleSave = async () => {
    if (!testName || !category || !date) {
      Alert.alert('Missing Info', 'Please complete all required fields.');
      return;
    }

    try {
      setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------
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
          setCategory(getCategoryFromName(text));
        }}
        placeholder="Enter test name"
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal style={styles.categoryScroll} showsHorizontalScrollIndicator={false}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.categoryButton, category === cat && styles.categoryButtonSelected]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>
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

      /* ----- Results with ranges/status/notes ----- */
      {rows.length > 0 && (
        <View style={styles.extractedBox}>
          <Text style={styles.sectionTitle}>🧪 Extracted Results</Text>

          {rows.map((r) => (
            <View key={r.originalKey} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultName}>{r.displayName}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(r.status) }]}>
                  <Text style={styles.badgeText}>{r.status}</Text>
                </View>
              </View>

              <Text style={styles.keyLine}>Key: {r.canonical}</Text>

              <View style={styles.valueRow}>
                <TextInput
                  style={styles.valueInput}
                  keyboardType="numeric"
                  value={String(extractedValues[r.canonical] ?? r.valueRaw)}
                  onChangeText={(text) =>
                    setExtractedValues((prev) => ({
                      ...prev,
                      // store by canonical to keep things clean
                      [r.canonical]: text,
                    }))
                  }
                />
                {!!r.unit && <Text style={styles.unitBubble}>{r.unit}</Text>}
              </View>

              {!!r.range && (
                <Text style={styles.rangeText}>
                  Reference: {r.range.min} – {r.range.max} {r.range.unit}
                </Text>
              )}

              {!!r.note && (
                <Text style={styles.noteText}>{r.note}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
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

  // date
  dateButton: {
    padding: 12, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, marginBottom: 20,
    alignItems: 'center',
  },

  // image
  imageButton: {
    backgroundColor: '#eee', padding: 12,
    borderRadius: 8, alignItems: 'center', marginBottom: 10,
  },
  imageButtonText: { fontWeight: '500', color: '#007AFF' },
  previewImage: {
    width: '100%', height: 200,
    borderRadius: 8, marginBottom: 20,
  },

  // categories
  categoryScroll: { marginBottom: 20, flexDirection: 'row' },
  categoryButton: {
    paddingHorizontal: 15, paddingVertical: 8,
    backgroundColor: '#f0f0f0', borderRadius: 20, marginRight: 10,
  },
  categoryButtonSelected: { backgroundColor: '#007AFF' },
  categoryText: { color: '#555', fontWeight: '500' },
  categoryTextSelected: { color: '#fff' },

  // extracted results
  extractedBox: {
    backgroundColor: '#f5faff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 10 },

  resultCard: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e5efff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  resultName: { fontWeight: '700', fontSize: 16, color: '#102a43' },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  keyLine: { color: '#66788a', marginBottom: 6 },

  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueInput: {
    flex: 1,
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 10, backgroundColor: '#fff',
  },
  unitBubble: {
    backgroundColor: '#eef3ff',
    borderColor: '#cfd9ff',
    borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14,
    color: '#1b2a4e',
    overflow: 'hidden',
  },
  rangeText: { marginTop: 6, color: '#334e68' },
  noteText: { marginTop: 4, color: '#6b7280', fontStyle: 'italic' },

  // save
  saveButton: {
    backgroundColor: '#1e90ff', padding: 15,
    borderRadius: 8, alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
});
