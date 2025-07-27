import React, { useEffect, useState } from 'react';
import { View, Text, Dimensions, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getAuth } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function TestChart() {
  const auth = getAuth();
  const user = auth.currentUser;
  const router = useRouter();
  const { name } = useLocalSearchParams(); // تحليل مثل A1C أو Creatinine

  const [labels, setLabels] = useState<string[]>([]);
  const [values, setValues] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid || !name || typeof name !== 'string') return;

      const q = query(
        collection(db, 'medicalTests'),
        where('userId', '==', user.uid),
        orderBy('date', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const results: { date: string, value: number }[] = [];

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const extracted = data.extractedValues || {};
        if (name in extracted) {
          const value = parseFloat(extracted[name]);
          if (!isNaN(value)) {
            results.push({
              date: data.date,
              value,
            });
          }
        }
      });

      setLabels(results.map(r => r.date.slice(5))); // "MM-DD"
      setValues(results.map(r => r.value));
    };

    fetchData();
  }, [user, name]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>{name} Progress Chart</Text>

      {values.length === 0 ? (
        <Text style={styles.noData}>No {name} data available.</Text>
      ) : (
        <LineChart
          data={{
            labels,
            datasets: [{ data: values }]
          }}
          width={Dimensions.get('window').width - 30}
          height={260}
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#f9f9f9',
            backgroundGradientTo: '#f0f0f0',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '6',
              strokeWidth: '2',
              stroke: '#007bff'
            }
          }}
          bezier
          style={{
            marginVertical: 20,
            borderRadius: 12
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  noData: { textAlign: 'center', marginTop: 40, color: '#888' },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10
  },
  backButtonText: {
    fontWeight: 'bold',
    color: '#333',
  },
});
