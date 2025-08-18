// app/TestChart.tsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { BarChart, type barDataItem } from 'react-native-gifted-charts';


import {
  resolveKey,
  getUnit,
  testRanges,
  fitToRangeMagnitude,
  getRangeStatus,
  testDictionary,
} from '../../testDictionary';

type TestItem = {
  id: string;
  date?: any; // string | Firestore Timestamp | Date
  extractedValues?: Record<string, any>;
};

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val?.seconds) return new Date(val.seconds * 1000);
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return Number.isFinite(d.getTime()) ? d : null;
};

const toNumber = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function pickValue(extracted: Record<string, any> | undefined, canonicalKey: string): number | null {
  if (!extracted) return null;
  for (const [k, v] of Object.entries(extracted)) {
    const kk = resolveKey(k) ?? k.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kk === canonicalKey) {
      const n = toNumber(v);
      return n == null ? null : n;
    }
  }
  return null;
}

// Force Gregorian EN date labels (avoids Hijri like "Safr.")
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDateShort = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;   // e.g., Aug 17
const fmtDateISO = (d: Date) => d.toISOString().slice(0, 10);

export default function TestChart() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [rows, setRows] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const raw = (name ?? '').toString();
  const key = resolveKey(raw) ?? raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const unit = getUnit(key);
  const ref = testRanges[key];
  const pretty = testDictionary[key] ?? key;

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => setAuthUser(u ?? null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        if (!authUser?.uid) {
          setRows([]);
          return;
        }
        const q = query(collection(db, 'medicalTests'), where('userId', '==', authUser.uid));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TestItem[];
        // keep valid dates + sort ascending
        const valid = data
          .map((r) => ({ ...r, __date: toDate(r.date) }))
          .filter((r) => r.__date) as Array<TestItem & { __date: Date }>;
        valid.sort((a, b) => a.__date.getTime() - b.__date.getTime());
        setRows(valid);
      } catch (err: any) {
        console.error('TestChart fetch error:', err);
        setErrorMsg(err?.message ?? 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [authUser?.uid]);

  // Build bar data
  const { data, yMin, yMax } = useMemo(() => {
    const pts: Array<{ date: Date; val: number }> = [];
    for (const r of rows) {
      const d = (r as any).__date ?? toDate(r.date);
      if (!d) continue;
      const rawVal = pickValue(r.extractedValues, key);
      if (rawVal == null) continue;
      const v = ref ? fitToRangeMagnitude(key, rawVal) : rawVal;
      pts.push({ date: d, val: v });
    }

    // combine same-day points, keep last
    pts.sort((a, b) => a.date.getTime() - b.date.getTime());
    const compacted: typeof pts = [];
    for (const p of pts) {
      const last = compacted[compacted.length - 1];
      if (last && last.date.toDateString() === p.date.toDateString()) compacted[compacted.length - 1] = p;
      else compacted.push(p);
    }

    if (!compacted.length) return { data: [] as barDataItem[], yMin: 0, yMax: 1 };

    let vMin = Math.min(...compacted.map((p) => p.val));
    let vMax = Math.max(...compacted.map((p) => p.val));
    const pad = Math.max(1e-6, (vMax - vMin) * 0.12);
    vMin -= pad;
    vMax += pad;
    if (ref) {
      vMin = Math.min(vMin, ref.min);
      vMax = Math.max(vMax, ref.max);
    }

    const items: barDataItem[] = compacted.map((p) => {
      const status = ref ? getRangeStatus(key, p.val) : 'Unknown';
      const color =
        status === 'High' || status === 'Low'
          ? '#e74c3c'
          : status.includes('Borderline')
          ? '#f39c12'
          : '#2d6cdf';
      return {
        value: p.val,
        label: fmtDateShort(p.date),
        frontColor: color,
        topLabelComponent: () => (
          <Text style={styles.topVal}>{p.val}{unit ? ` ${unit}` : ''}</Text>
        ),
      };
    });

    return { data: items, yMin: vMin, yMax: vMax };
  }, [rows, key, unit, ref]);

  const width = Dimensions.get('window').width - 24;

  if (!raw) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No metric provided</Text>
        <Text style={styles.emptySub}>This screen expects a test key in the route.</Text>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnPrimary]}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading chart…</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#d32f2f', textAlign: 'center' }}>{errorMsg}</Text>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!data.length) {
    return (
      <View style={styles.container}>
        <Header title={`${testDictionary[key] ?? key}${unit ? ` (${unit})` : ''}`} onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No data points</Text>
          <Text style={styles.emptySub}>
            We couldn’t find any values for “{key}”. Make sure this metric exists in your test results.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={`${pretty}${unit ? ` (${unit})` : ''}`} onBack={() => router.back()} />

      {ref && (
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: '#eef8f1', borderColor: '#bfe8cb' }]}>
            <Text style={[styles.badgeText, { color: '#1b5e20' }]}>
              Min {ref.min} {ref.unit || unit}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: '#fdeeee', borderColor: '#f3b6b6' }]}>
            <Text style={[styles.badgeText, { color: '#b71c1c' }]}>
              Max {ref.max} {ref.unit || unit}
            </Text>
          </View>
        </View>
      )}

      <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
        <BarChart
          data={data}
          width={width}
          height={320}
          barWidth={28}
          barBorderRadius={8}
          // axis
          yAxisLabelWidth={44}
          yAxisTextStyle={{ fontSize: 10 }}
          xAxisLabelTextStyle={{ fontSize: 10 }}
          xAxisColor={'#222'}
          yAxisColor={'#222'}
          // grid
          noOfSections={5}
          rulesColor={'#e6e8eb'}
          rulesType={'dashed'}
          yAxisOffset={Math.min(0, Math.floor(yMin))}
          yAxisLabelTexts={buildTicks(yMin, yMax, 5)}
          // reference lines
          showReferenceLine1={!!ref}
          referenceLine1Position={ref?.min}
          referenceLine1Config={{ color: '#4caf50', thickness: 1 }}
          showReferenceLine2={!!ref}
          referenceLine2Position={ref?.max}
          referenceLine2Config={{ color: '#e53935', thickness: 1 }}
          referenceLinesOverChartContent={false}
          // interaction fixing a problem
          disablePress={true}
        />
      </View>
    </View>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} style={[styles.btn, styles.btnPrimary]}>
        <Text style={styles.btnText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 72 }} />
    </View>
  );
}

function buildTicks(min: number, max: number, n: number): string[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || n < 2) return [];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const v = min + i * step;
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 8 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },

  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#2d6cdf' },
  btnText: { color: '#fff', fontWeight: '700' },

  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  topVal: { fontSize: 10, color: '#333', marginBottom: 4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { color: '#666', textAlign: 'center', marginBottom: 14 },
});
