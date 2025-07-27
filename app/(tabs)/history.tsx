import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput,
  Pressable, Platform
} from 'react-native';
import { ScrollView } from 'react-native';

import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth } from 'firebase/auth';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';

export default function History() {
  const auth = getAuth();
  const user = auth.currentUser;
  const router = useRouter();

  const [tests, setTests] = useState<{ id: string; [key: string]: any }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [chartTestName, setChartTestName] = useState('');


  useEffect(() => {
    if (!user?.uid) return;

    const fetchTests = async () => {
      const q = query(
        collection(db, 'medicalTests'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTests(data);
    };

    fetchTests();
  }, [user]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'medicalTests', id));
      setTests(prev => prev.filter(test => test.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const filteredTests = tests.filter((test: any) => {
    const matchesSearch = test.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = filterDate
      ? test.date === filterDate.toISOString().split('T')[0]
      : true;
    const matchesCategory = selectedCategory
      ? test.category === selectedCategory
      : true;
    return matchesSearch && matchesDate && matchesCategory;
  });

  const categories = ['Blood','Urine', 'X-Ray', 'MRI', 'Other'];

  const renderItem = ({ item }: any) => (
    <View style={styles.item}>
      <Text style={styles.name}>🧪 {item.name}</Text>
      <Text style={styles.details}>📂 Category: {item.category}</Text>
      <Text style={styles.details}>📅 Date: {item.date}</Text>

      {item.extractedValues && Object.keys(item.extractedValues).length > 0 && (
        <View style={styles.resultsBox}>
          <Text style={styles.resultsTitle}>📊 Results:</Text>
          {Object.entries(item.extractedValues).map(([key, value]) => (
            <Text key={key} style={styles.resultLine}>
              - {key} = {value as string}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => router.push(`/editTest?id=${item.id}`)}
          style={[styles.actionButton, { backgroundColor: '#007bff' }]}
        >
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item.id)}
          style={[styles.actionButton, { backgroundColor: '#dc3545' }]}
        >
          <Text style={styles.actionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
  <View style={styles.chartSelector}>
  <Text style={{ marginBottom: 6, fontWeight: 'bold' }}>📊 Show Chart for Test:</Text>
  <View style={styles.chartButtonsRow}>
    {['A1C', 'Creatinine', 'Glucose', 'WBC', 'Other'].map(testName => (
      <Pressable
        key={testName}
        onPress={() => router.push(`/TestChart?name=${encodeURIComponent(testName)}`)}
        style={styles.chartButton}
      >
        <Text style={styles.chartButtonText}>{testName}</Text>
      </Pressable>
    ))}
  </View>
</View>


  return (
    <View style={styles.container}>
     <View style={styles.profileContainer}>
  <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
    <Text style={styles.profileButtonText}>👤</Text>
  </Pressable>
</View>

      <Text style={styles.title}>Medical Test History</Text>
      <Pressable
        onPress={() => router.push('/add-manual')}
        style={styles.addTestButton}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>+ Add Test</Text>
      </Pressable>


      <TextInput
        style={styles.searchBar}
        placeholder="Search by test name"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
        <Text>{filterDate ? filterDate.toISOString().split('T')[0] : 'Filter by date'}</Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={filterDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setFilterDate(selectedDate);
          }}
        />
      )}

      <Text style={styles.label}>Category</Text>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={styles.categoryScroll}
  contentContainerStyle={styles.categoryContainer}
>
  {categories.map((cat) => (
    <Pressable
      key={cat}
      onPress={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
      style={[
        styles.categoryButton,
        selectedCategory === cat && styles.selectedCategory,
      ]}
    >
      <Text
        style={[
          styles.categoryText,
          selectedCategory === cat && styles.categoryTextSelected,
        ]}
      >
        {cat}
      </Text>
    </Pressable>
  ))}
</ScrollView>

      
      <FlatList
        data={filteredTests}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No medical tests found.</Text>}
        ListFooterComponent={
          <Pressable onPress={() => auth.signOut()} style={styles.logoutButton}>
            <Text style={{ color: 'white' }}>Logout</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  item: {
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 10, padding: 15, marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  name: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  details: { color: '#555' },
  resultsBox: { marginTop: 10 },
  resultsTitle: { fontWeight: 'bold', marginBottom: 4 },
  resultLine: { marginLeft: 6 },
  searchBar: {
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  dateButton: {
    padding: 10, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, marginBottom: 15, alignItems: 'center'
  },
 headerRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
},

profileContainer: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  marginBottom: 10,
},

profileButton: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#001f3f', // Navy blue
  justifyContent: 'center',
  alignItems: 'center',
},

profileButtonText: {
  color: '#fff',
  fontSize: 20,
},


  empty: {
    textAlign: 'center', marginTop: 40, color: '#777'
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    flexWrap: 'wrap'
  },
  label: {
  fontWeight: 'bold',
  marginBottom: 6,
  fontSize: 16,
},

categoryScroll: {
  marginBottom: 15,
},


categoryButton: {
  backgroundColor: '#f0f0f0',
  paddingVertical: 8,
  paddingHorizontal: 16,
  borderRadius: 20,
  marginRight: 8,
  borderWidth: 1,
  borderColor: '#ccc',
},
selectedCategory: {
  backgroundColor: '#001f3f', // Navy blue (متناسق مع زر البروفايل)
  borderColor: '#001f3f',
},
categoryText: {
  color: '#333',
  fontSize: 14,
  fontWeight: '600',
},
categoryTextSelected: {
  color: '#fff',
  fontWeight: 'bold',
},

  buttonRow: {
    flexDirection: 'row',
    marginTop: 10
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  addTestButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: '#555',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  chartSelector: {
  marginBottom: 20,
  padding: 10,
  backgroundColor: '#f1f1f1',
  borderRadius: 10
},
chartButtonsRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
chartButton: {
  backgroundColor: '#007bff',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
  margin: 4
},
chartButtonText: {
  color: '#fff',
  fontWeight: 'bold'
},



});
