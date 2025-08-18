// app/profile.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Platform,
} from "react-native";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

function parseYYYYMMDD(val?: string): Date | null {
  if (!val) return null;
  // Expecting "YYYY-MM-DD"
  const d = new Date(val);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatYYYYMMDD(d: Date | null): string {
  if (!d) return "";
  const iso = d.toISOString();
  return iso.slice(0, 10); // YYYY-MM-DD
}

export default function Profile() {
  const [name, setName] = useState("");
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [medicalIssues, setMedicalIssues] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setDobDate(parseYYYYMMDD(data.dob) ?? null);
          setHeight(data.height || "");
          setWeight(data.weight || "");
          setMedicalIssues(data.medicalIssues || "");
          setProfileImage(data.profileImage || null);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, [user]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(
        docRef,
        {
          name,
          dob: formatYYYYMMDD(dobDate), // <-- نخزنها كنص YYYY-MM-DD
          height,
          weight,
          medicalIssues,
          profileImage,
        },
        { merge: true }
      );
      Alert.alert("Success", "Profile updated successfully!");
      router.back();
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Profile</Text>

      {/* Profile photo */}
      <View style={styles.imageContainer}>
        <Pressable onPress={pickImage}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={{ color: "#888" }}>Add Photo</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Enter your full name"
      />

      {/* DOB with Date Picker */}
      <Text style={styles.label}>Date of Birth</Text>
      <Pressable
        style={styles.dateButton}
        onPress={() => setShowDobPicker(true)}
      >
        <Text>{dobDate ? formatYYYYMMDD(dobDate) : "Select date"}</Text>
      </Pressable>

      {showDobPicker && (
        <DateTimePicker
          value={dobDate ?? new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            setShowDobPicker(false);
            if (selectedDate) setDobDate(selectedDate);
          }}
          maximumDate={new Date()} // تاريخ الميلاد لا يكون في المستقبل
        />
      )}

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput
        style={styles.input}
        value={height}
        onChangeText={setHeight}
        keyboardType="numeric"
        placeholder="Enter height"
      />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        placeholder="Enter weight"
      />

      <Text style={styles.label}>Medical Issues</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        value={medicalIssues}
        onChangeText={setMedicalIssues}
        placeholder="List any medical issues"
        multiline
      />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Profile</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
  },
  backButton: {
    marginBottom: 15,
    alignSelf: "flex-start",
    backgroundColor: "#ccc",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  backButtonText: { color: "#333", fontWeight: "bold" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  imageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  saveButton: {
    backgroundColor: "#1e90ff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
