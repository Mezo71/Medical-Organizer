// app/History.tsx


import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  UIManager,
  LayoutAnimation,
  Modal,
  Image,
  Alert,
} from 'react-native';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth, signOut } from 'firebase/auth';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { resolveKey, testDictionary } from '../../testDictionary';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TestItem = {
  id: string;
  name?: string;
  category?: string;
  date?: any; // string | Firestore Timestamp | Date
  extractedValues?: Record<string, any>;
  [key: string]: any;
};

const CHART_FAVORITES = [
  'A1C', 'GLUCOSE', 'CREATININE', 'HGB', 'HCT', 'RBC', 'WBC', 'PLT',
  'LDL', 'HDL', 'TSH', 'CRP', 'MCV', 'MCH', 'MCHC', 'RDWCV', 'RDWSD',
];
const INITIAL_CHIP_COUNT = 8;
const CATEGORY_OPTIONS = ['Blood', 'Urine', 'X-Ray', 'MRI', 'Other'];
const RESULTS_LIMIT = 10;

export default function History() {
  const auth = getAuth();
  const user = auth.currentUser;
  const router = useRouter();

  const [tests, setTests] = useState<TestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [metricPickerVisible, setMetricPickerVisible] = useState(false);
  const [chartFilter, setChartFilter] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // ---------- fetch ----------
  useEffect(() => {
    if (!user?.uid) return;

    const fetchTests = async () => {
      const q = query(collection(db, 'medicalTests'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TestItem[];
      data.sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0));
      setTests(data);
    };

    const fetchProfileImage = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const s = await getDoc(userRef);
        if (s.exists()) setProfileImage((s.data() as any).profileImage ?? null);
      } catch (e) {
        console.error('Failed to load profile image:', e);
      }
    };

    fetchTests();
    fetchProfileImage();
  }, [user?.uid]);

  // ---------- helpers ----------
  const toDate = (val: any): Date | null => {
    if (!val) return null;
    try {
      if (val?.seconds) return new Date(val.seconds * 1000);
      if (val instanceof Date) return val;
      return new Date(String(val));
    } catch { return null; }
  };
  const dateOnlyStr = (v: any) => (toDate(v)?.toISOString().split('T')[0] ?? null);
  const normalize = (v: any) => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const compact = (v: any) => normalize(v).replace(/[^a-z0-9]+/g, ' ').trim();
  const buildHaystack = (t: TestItem) => {
    const parts: string[] = [];
    if (t.name) parts.push(t.name);
    if (t.category) parts.push(t.category);
    if (t.extractedValues) {
      for (const [k, v] of Object.entries(t.extractedValues)) {
        parts.push(k);
        if (v != null) parts.push(String(v));
      }
    }
    return compact(parts.join(' '));
  };

  // ---------- filtering ----------
  const filteredTests = useMemo(() => {
    const tokens = compact(searchQuery).split(' ').filter(Boolean);
    return tests.filter((t) => {
      const matchesDate = filterDate ? dateOnlyStr(t.date) === dateOnlyStr(filterDate) : true;
      const matchesCategory = selectedCategory ? normalize(t.category) === normalize(selectedCategory) : true;
      if (!tokens.length) return matchesDate && matchesCategory;
      const hay = buildHaystack(t);
      return tokens.every((tok) => hay.includes(tok)) && matchesDate && matchesCategory;
    });
  }, [tests, searchQuery, filterDate, selectedCategory]);

  // ---------- dynamic metrics ----------
  const { metricsAll, metricsTop } = useMemo(() => {
    const freq = new Map<string, number>();
    for (const t of tests) {
      const ev = t.extractedValues;
      if (!ev) continue;
      for (const k of Object.keys(ev)) {
        const key = resolveKey(k) ?? k.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!key) continue;
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
    }
    for (const f of CHART_FAVORITES) freq.set(f, (freq.get(f) ?? 0));

    const favOrder = new Map(CHART_FAVORITES.map((k, i) => [k, i]));
    const allKeys = Array.from(freq.keys()).sort((a, b) => {
      const ai = favOrder.get(a) ?? Infinity;
      const bi = favOrder.get(b) ?? Infinity;
      if (ai !== bi) return ai - bi;
      const fa = freq.get(a) ?? 0, fb = freq.get(b) ?? 0;
      if (fa !== fb) return fb - fa;
      return a.localeCompare(b);
    });

    return { metricsAll: allKeys, metricsTop: allKeys.slice(0, INITIAL_CHIP_COUNT) };
  }, [tests]);

  const filteredMetricList = useMemo(() => {
    if (!chartFilter.trim()) return metricsAll;
    const q = chartFilter.trim().toLowerCase();
    return metricsAll.filter((k) => {
      const label = (testDictionary[k] ?? k).toLowerCase();
      return k.toLowerCase().includes(q) || label.includes(q);
    });
  }, [metricsAll, chartFilter]);

  // ---------- list data ----------
  const listData: Array<{ __intro?: true } | TestItem> = useMemo(
    () => [{ __intro: true }, ...filteredTests],
    [filteredTests]
  );

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  };

  // ---------- delete ----------
  const handleDelete = async (item: TestItem) => {
    if (!item.id) return;
    Alert.alert(
      'Delete test',
      'Are you sure you want to delete this test?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'medicalTests', item.id));
              setTests((prev) => prev.filter((t) => t.id !== item.id));
              Alert.alert('Deleted', 'Test has been deleted successfully.');
            } catch (e) {
              console.error('Error deleting test:', e);
              Alert.alert('Error', 'Failed to delete test.');
            }
          },
        },
      ]
    );
  };

  // ---------- logout ----------
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/'); // adjust to your login route
    } catch (e) {
      console.error('Logout error:', e);
      Alert.alert('Error', 'Failed to logout.');
    }
  };

  // ---------- header ----------
  const renderStickyHeader = () => (
    <View style={styles.stickyHeader}>
      <View style={styles.profileContainer}>
        <Pressable onPress={() => router.push('/profile')} style={styles.profileButton} hitSlop={8}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileAvatar} />
          ) : (
            <Text style={styles.profileButtonText}>👤</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.title}>Medical Test History</Text>

      <Pressable onPress={() => router.push('/add-manual')} style={styles.addTestButton}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>+ Add Test</Text>
      </Pressable>

      <TextInput
        style={styles.searchBar}
        placeholder="Search by any word (e.g., hemoglobin, WBC, platelets, A1C)…"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  // ---------- intro block ----------
  const renderIntroBlock = () => (
    <View>
      {/* Date filter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => setShowDatePicker(true)} style={[styles.dateButton, { flex: 1 }]}>
          <Text>{filterDate ? dateOnlyStr(filterDate) : 'Filter by date'}</Text>
        </Pressable>
        {filterDate && (
          <Pressable onPress={() => setFilterDate(null)} style={[styles.dateButton, { backgroundColor: '#eee' }]}>
            <Text>Clear</Text>
          </Pressable>
        )}
      </View>

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

      {/* Categories */}
      <Text style={styles.label}>Category</Text>
      <FlatList
        data={CATEGORY_OPTIONS}
        keyExtractor={(cat) => cat}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryListContent}
        renderItem={({ item: cat }) => (
          <Pressable
            onPress={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
            style={[styles.categoryButton, selectedCategory === cat && styles.selectedCategory]}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextSelected]}>
              {cat}
            </Text>
          </Pressable>
        )}
        style={styles.categoryList}
      />

      {/* Compact chart selector strip */}
      <View style={styles.chartStrip}>
        <View style={styles.stripHeader}>
          <Text style={{ fontWeight: 'bold' }}>📊 Charts</Text>
          <Pressable onPress={() => setMetricPickerVisible(true)} hitSlop={8}>
            <Text style={styles.link}>More…</Text>
          </Pressable>
        </View>

        <FlatList
          data={metricsTop}
          keyExtractor={(k) => k}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
          renderItem={({ item: key }) => (
            <Pressable
              onPress={() => router.push(`/TestChart?name=${encodeURIComponent(key)}`)}
              style={styles.stripChip}
            >
              <Text numberOfLines={1} style={styles.stripChipText}>
                {testDictionary[key] ?? key}
              </Text>
            </Pressable>
          )}
          style={{ marginTop: 6 }}
        />
      </View>
    </View>
  );

  // ---------- results renderer ----------
  const renderResults = (item: TestItem) => {
    const entries = item.extractedValues ? Object.entries(item.extractedValues) : [];
    if (!entries.length) return null;

    const isOpen = !!expanded[item.id];
    if (!isOpen) return <Text style={styles.tapHint}>Tap to view results…</Text>;

    const sorted = entries.sort(([a], [b]) => a.localeCompare(b)).slice(0, RESULTS_LIMIT);

    return (
      <View style={styles.resultsBox}>
        <Text style={styles.resultsTitle}>📊 Results:</Text>
        <View style={styles.chipsWrap}>
          {sorted.map(([k, v]) => (
            <View key={k} style={styles.chip}>
              <Text style={styles.chipText}>
                {k} = {String(v)}
              </Text>
              <Pressable onPress={() => router.push(`/TestChart?name=${encodeURIComponent(k)}`)}>
                <Text style={styles.linkText}>  • View chart</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ---------- item ----------
  const renderItem = ({ item }: { item: any }) => {
    if (item.__intro) {
      return (
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          {renderIntroBlock()}
        </View>
      );
    }

    const isOpen = !!expanded[item.id];
    return (
      <Pressable
        onPress={() => toggleExpand(item.id)}
        onLongPress={() => router.push(`/editTest?id=${item.id}`)}
        style={[styles.item, isOpen && styles.itemExpanded]}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.name}>🧪 {item.name}</Text>
          <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
        </View>
        <Text style={styles.details}>📂 Category: {item.category}</Text>
        <Text style={styles.details}>📅 Date: {dateOnlyStr(item.date) ?? '-'}</Text>

        {renderResults(item)}

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => router.push(`/editTest?id=${item.id}`)}
            style={[styles.actionButton, { backgroundColor: '#007bff' }]}
          >
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>

          {/* DELETE button */}
          <Pressable
            onPress={() => handleDelete(item)}
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
          >
            <Text style={styles.actionText}>Delete</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ __intro: true } as any, ...filteredTests]}
        keyExtractor={(it: any) => (it.__intro ? '__intro' : it.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderStickyHeader}
        stickyHeaderIndices={[0]}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={{ color: 'white' }}>Logout</Text>
          </Pressable>
        }
        nestedScrollEnabled={false}
      />

      {/* Metric picker modal */}
      <Modal
        visible={metricPickerVisible}
        animationType="slide"
        onRequestClose={() => setMetricPickerVisible(false)}
        transparent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a metric</Text>
              <Pressable onPress={() => setMetricPickerVisible(false)}>
                <Text style={styles.link}>Close</Text>
              </Pressable>
            </View>

            <TextInput
              style={[styles.searchBar, { marginBottom: 10 }]}
              placeholder="Filter metrics (e.g., hemoglobin, WBC)…"
              value={chartFilter}
              onChangeText={setChartFilter}
            />

            <FlatList
              data={filteredMetricList}
              keyExtractor={(k) => k}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: key }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    setMetricPickerVisible(false);
                    router.push(`/TestChart?name=${encodeURIComponent(key)}`);
                  }}
                >
                  <Text style={styles.modalRowTitle}>{testDictionary[key] ?? key}</Text>
                  <Text style={styles.modalRowSub}>{key}</Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.modalSep} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  listContent: { paddingBottom: 30 },

  // Sticky header
  stickyHeader: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eaeaea',
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  searchBar: {
    borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 10,
  },

  // Profile avatar
  profileContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  profileButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#001f3f',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  profileButtonText: { color: '#fff', fontSize: 20 },
  profileAvatar: { width: '100%', height: '100%', resizeMode: 'cover' },

  addTestButton: {
    backgroundColor: '#007bff',
    padding: 12, borderRadius: 8, alignItems: 'center',
    marginBottom: 12,
  },

  // Cards
  item: {
    borderWidth: 1, borderColor: '#e3e3e3',
    borderRadius: 12, padding: 14, marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#f9f9f9',
  },
  itemExpanded: { backgroundColor: '#f3f7ff', borderColor: '#cfe0ff' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { color: '#666', fontSize: 14 },
  name: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  details: { color: '#555' },

  // Results
  resultsBox: { marginTop: 10 },
  resultsTitle: { fontWeight: 'bold', marginBottom: 6 },
  tapHint: { marginTop: 8, color: '#888', fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#eef3ff',
    borderRadius: 16, borderWidth: 1, borderColor: '#cfd9ff',
    marginRight: 6, marginBottom: 6,
    flexDirection: 'row', alignItems: 'center',
  },
  chipText: { color: '#1b2a4e', fontWeight: '600' },
  linkText: { color: '#007bff', fontWeight: '600' },

  // Date
  dateButton: {
    padding: 10, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, marginBottom: 15, alignItems: 'center',
  },

  // Categories
  label: { fontWeight: 'bold', marginBottom: 6, fontSize: 16 },
  categoryList: { marginBottom: 15, paddingLeft: 20 },
  categoryListContent: { paddingRight: 20, alignItems: 'center' },
  categoryButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, marginRight: 8,
    borderWidth: 1, borderColor: '#ccc',
  },
  selectedCategory: { backgroundColor: '#001f3f', borderColor: '#001f3f' },
  categoryText: { color: '#333', fontSize: 14, fontWeight: '600' },
  categoryTextSelected: { color: '#fff', fontWeight: 'bold' },

  // Actions
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: 'bold' },

  // Footer
  logoutButton: {
    marginTop: 10, alignSelf: 'center',
    backgroundColor: '#555',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 8,
  },

  // Compact chart strip
  chartStrip: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 10,
    backgroundColor: '#f6f7f9',
    borderRadius: 10,
  },
  stripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stripChip: {
    backgroundColor: '#007bff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    maxWidth: 220,
  },
  stripChipText: { color: '#fff', fontWeight: '600' },
  link: { color: '#007bff', fontWeight: '600' },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '75%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalRow: { paddingVertical: 10 },
  modalRowTitle: { fontSize: 15, fontWeight: '600', color: '#1b2a4e' },
  modalRowSub: { color: '#65748b', marginTop: 2, fontSize: 12 },
  modalSep: { height: StyleSheet.hairlineWidth, backgroundColor: '#eaeaea' },
});
