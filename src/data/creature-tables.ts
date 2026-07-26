// GENERATED FILE — do not edit by hand.
// Regenerate with: node tools/fetch-creature-tables.mjs
//
// Source: Pathfinder GM Core, "Building Creatures" (pg. 112-124), retrieved via
// the Archives of Nethys index. Game mechanics are Open Game Content under the
// ORC licence; see NOTICE.md.
//
// Retrieved: 2026-07-26T21:03:35.396Z

export interface CreatureTable {
  caption: string;
  columns: string[];
  rows: string[][];
  byLevel: Record<string, Record<string, number | string>> | null;
}

export interface CreatureTableGroup {
  source: { id: string; name: string; page: string | null };
  tables: CreatureTable[];
}

export const CREATURE_TABLES = {
  "attributeModifiers": {
    "source": {
      "id": "rules-2881",
      "name": "Attribute Modifiers",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 114"
    },
    "tables": [
      {
        "caption": "Table 2-1: Ability Modifier Scales",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "—",
            "+3",
            "+2",
            "+0"
          ],
          [
            "0",
            "—",
            "+3",
            "+2",
            "+0"
          ],
          [
            "1",
            "+5",
            "+4",
            "+3",
            "+1"
          ],
          [
            "2",
            "+5",
            "+4",
            "+3",
            "+1"
          ],
          [
            "3",
            "+5",
            "+4",
            "+3",
            "+1"
          ],
          [
            "4",
            "+6",
            "+5",
            "+3",
            "+2"
          ],
          [
            "5",
            "+6",
            "+5",
            "+4",
            "+2"
          ],
          [
            "6",
            "+7",
            "+5",
            "+4",
            "+2"
          ],
          [
            "7",
            "+7",
            "+6",
            "+4",
            "+2"
          ],
          [
            "8",
            "+7",
            "+6",
            "+4",
            "+3"
          ],
          [
            "9",
            "+7",
            "+6",
            "+4",
            "+3"
          ],
          [
            "10",
            "+8",
            "+7",
            "+5",
            "+3"
          ],
          [
            "11",
            "+8",
            "+7",
            "+5",
            "+3"
          ],
          [
            "12",
            "+8",
            "+7",
            "+5",
            "+4"
          ],
          [
            "13",
            "+9",
            "+8",
            "+5",
            "+4"
          ],
          [
            "14",
            "+9",
            "+8",
            "+5",
            "+4"
          ],
          [
            "15",
            "+9",
            "+8",
            "+6",
            "+4"
          ],
          [
            "16",
            "+10",
            "+9",
            "+6",
            "+5"
          ],
          [
            "17",
            "+10",
            "+9",
            "+6",
            "+5"
          ],
          [
            "18",
            "+10",
            "+9",
            "+6",
            "+5"
          ],
          [
            "19",
            "+11",
            "+10",
            "+6",
            "+5"
          ],
          [
            "20",
            "+11",
            "+10",
            "+7",
            "+6"
          ],
          [
            "21",
            "+11",
            "+10",
            "+7",
            "+6"
          ],
          [
            "22",
            "+11",
            "+10",
            "+8",
            "+6"
          ],
          [
            "23",
            "+11",
            "+10",
            "+8",
            "+6"
          ],
          [
            "24",
            "+13",
            "+12",
            "+9",
            "+7"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": "—",
            "high": 3,
            "moderate": 2,
            "low": 0
          },
          "1": {
            "extreme": 5,
            "high": 4,
            "moderate": 3,
            "low": 1
          },
          "2": {
            "extreme": 5,
            "high": 4,
            "moderate": 3,
            "low": 1
          },
          "3": {
            "extreme": 5,
            "high": 4,
            "moderate": 3,
            "low": 1
          },
          "4": {
            "extreme": 6,
            "high": 5,
            "moderate": 3,
            "low": 2
          },
          "5": {
            "extreme": 6,
            "high": 5,
            "moderate": 4,
            "low": 2
          },
          "6": {
            "extreme": 7,
            "high": 5,
            "moderate": 4,
            "low": 2
          },
          "7": {
            "extreme": 7,
            "high": 6,
            "moderate": 4,
            "low": 2
          },
          "8": {
            "extreme": 7,
            "high": 6,
            "moderate": 4,
            "low": 3
          },
          "9": {
            "extreme": 7,
            "high": 6,
            "moderate": 4,
            "low": 3
          },
          "10": {
            "extreme": 8,
            "high": 7,
            "moderate": 5,
            "low": 3
          },
          "11": {
            "extreme": 8,
            "high": 7,
            "moderate": 5,
            "low": 3
          },
          "12": {
            "extreme": 8,
            "high": 7,
            "moderate": 5,
            "low": 4
          },
          "13": {
            "extreme": 9,
            "high": 8,
            "moderate": 5,
            "low": 4
          },
          "14": {
            "extreme": 9,
            "high": 8,
            "moderate": 5,
            "low": 4
          },
          "15": {
            "extreme": 9,
            "high": 8,
            "moderate": 6,
            "low": 4
          },
          "16": {
            "extreme": 10,
            "high": 9,
            "moderate": 6,
            "low": 5
          },
          "17": {
            "extreme": 10,
            "high": 9,
            "moderate": 6,
            "low": 5
          },
          "18": {
            "extreme": 10,
            "high": 9,
            "moderate": 6,
            "low": 5
          },
          "19": {
            "extreme": 11,
            "high": 10,
            "moderate": 6,
            "low": 5
          },
          "20": {
            "extreme": 11,
            "high": 10,
            "moderate": 7,
            "low": 6
          },
          "21": {
            "extreme": 11,
            "high": 10,
            "moderate": 7,
            "low": 6
          },
          "22": {
            "extreme": 11,
            "high": 10,
            "moderate": 8,
            "low": 6
          },
          "23": {
            "extreme": 11,
            "high": 10,
            "moderate": 8,
            "low": 6
          },
          "24": {
            "extreme": 13,
            "high": 12,
            "moderate": 9,
            "low": 7
          },
          "-1": {
            "extreme": "—",
            "high": 3,
            "moderate": 2,
            "low": 0
          }
        }
      }
    ]
  },
  "perception": {
    "source": {
      "id": "rules-2882",
      "name": "Perception",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 115"
    },
    "tables": [
      {
        "caption": "Table 2-2: Perception",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low",
          "Terrible"
        ],
        "rows": [
          [
            "-1",
            "+9",
            "+8",
            "+5",
            "+2",
            "+0"
          ],
          [
            "0",
            "+10",
            "+9",
            "+6",
            "+3",
            "+1"
          ],
          [
            "1",
            "+11",
            "+10",
            "+7",
            "+4",
            "+2"
          ],
          [
            "2",
            "+12",
            "+11",
            "+8",
            "+5",
            "+3"
          ],
          [
            "3",
            "+14",
            "+12",
            "+9",
            "+6",
            "+4"
          ],
          [
            "4",
            "+15",
            "+14",
            "+11",
            "+8",
            "+6"
          ],
          [
            "5",
            "+17",
            "+15",
            "+12",
            "+9",
            "+7"
          ],
          [
            "6",
            "+18",
            "+17",
            "+14",
            "+11",
            "+8"
          ],
          [
            "7",
            "+20",
            "+18",
            "+15",
            "+12",
            "+10"
          ],
          [
            "8",
            "+21",
            "+19",
            "+16",
            "+13",
            "+11"
          ],
          [
            "9",
            "+23",
            "+21",
            "+18",
            "+15",
            "+12"
          ],
          [
            "10",
            "+24",
            "+22",
            "+19",
            "+16",
            "+14"
          ],
          [
            "11",
            "+26",
            "+24",
            "+21",
            "+18",
            "+15"
          ],
          [
            "12",
            "+27",
            "+25",
            "+22",
            "+19",
            "+16"
          ],
          [
            "13",
            "+29",
            "+26",
            "+23",
            "+20",
            "+18"
          ],
          [
            "14",
            "+30",
            "+28",
            "+25",
            "+22",
            "+19"
          ],
          [
            "15",
            "+32",
            "+29",
            "+26",
            "+23",
            "+20"
          ],
          [
            "16",
            "+33",
            "+30",
            "+28",
            "+25",
            "+22"
          ],
          [
            "17",
            "+35",
            "+32",
            "+29",
            "+26",
            "+23"
          ],
          [
            "18",
            "+36",
            "+33",
            "+30",
            "+27",
            "+24"
          ],
          [
            "19",
            "+38",
            "+35",
            "+32",
            "+29",
            "+26"
          ],
          [
            "20",
            "+39",
            "+36",
            "+33",
            "+30",
            "+27"
          ],
          [
            "21",
            "+41",
            "+38",
            "+35",
            "+32",
            "+28"
          ],
          [
            "22",
            "+43",
            "+39",
            "+36",
            "+33",
            "+30"
          ],
          [
            "23",
            "+44",
            "+40",
            "+37",
            "+34",
            "+31"
          ],
          [
            "24",
            "+46",
            "+42",
            "+38",
            "+36",
            "+32"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": 10,
            "high": 9,
            "moderate": 6,
            "low": 3,
            "terrible": 1
          },
          "1": {
            "extreme": 11,
            "high": 10,
            "moderate": 7,
            "low": 4,
            "terrible": 2
          },
          "2": {
            "extreme": 12,
            "high": 11,
            "moderate": 8,
            "low": 5,
            "terrible": 3
          },
          "3": {
            "extreme": 14,
            "high": 12,
            "moderate": 9,
            "low": 6,
            "terrible": 4
          },
          "4": {
            "extreme": 15,
            "high": 14,
            "moderate": 11,
            "low": 8,
            "terrible": 6
          },
          "5": {
            "extreme": 17,
            "high": 15,
            "moderate": 12,
            "low": 9,
            "terrible": 7
          },
          "6": {
            "extreme": 18,
            "high": 17,
            "moderate": 14,
            "low": 11,
            "terrible": 8
          },
          "7": {
            "extreme": 20,
            "high": 18,
            "moderate": 15,
            "low": 12,
            "terrible": 10
          },
          "8": {
            "extreme": 21,
            "high": 19,
            "moderate": 16,
            "low": 13,
            "terrible": 11
          },
          "9": {
            "extreme": 23,
            "high": 21,
            "moderate": 18,
            "low": 15,
            "terrible": 12
          },
          "10": {
            "extreme": 24,
            "high": 22,
            "moderate": 19,
            "low": 16,
            "terrible": 14
          },
          "11": {
            "extreme": 26,
            "high": 24,
            "moderate": 21,
            "low": 18,
            "terrible": 15
          },
          "12": {
            "extreme": 27,
            "high": 25,
            "moderate": 22,
            "low": 19,
            "terrible": 16
          },
          "13": {
            "extreme": 29,
            "high": 26,
            "moderate": 23,
            "low": 20,
            "terrible": 18
          },
          "14": {
            "extreme": 30,
            "high": 28,
            "moderate": 25,
            "low": 22,
            "terrible": 19
          },
          "15": {
            "extreme": 32,
            "high": 29,
            "moderate": 26,
            "low": 23,
            "terrible": 20
          },
          "16": {
            "extreme": 33,
            "high": 30,
            "moderate": 28,
            "low": 25,
            "terrible": 22
          },
          "17": {
            "extreme": 35,
            "high": 32,
            "moderate": 29,
            "low": 26,
            "terrible": 23
          },
          "18": {
            "extreme": 36,
            "high": 33,
            "moderate": 30,
            "low": 27,
            "terrible": 24
          },
          "19": {
            "extreme": 38,
            "high": 35,
            "moderate": 32,
            "low": 29,
            "terrible": 26
          },
          "20": {
            "extreme": 39,
            "high": 36,
            "moderate": 33,
            "low": 30,
            "terrible": 27
          },
          "21": {
            "extreme": 41,
            "high": 38,
            "moderate": 35,
            "low": 32,
            "terrible": 28
          },
          "22": {
            "extreme": 43,
            "high": 39,
            "moderate": 36,
            "low": 33,
            "terrible": 30
          },
          "23": {
            "extreme": 44,
            "high": 40,
            "moderate": 37,
            "low": 34,
            "terrible": 31
          },
          "24": {
            "extreme": 46,
            "high": 42,
            "moderate": 38,
            "low": 36,
            "terrible": 32
          },
          "-1": {
            "extreme": 9,
            "high": 8,
            "moderate": 5,
            "low": 2,
            "terrible": 0
          }
        }
      }
    ]
  },
  "skills": {
    "source": {
      "id": "rules-2885",
      "name": "Skills",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 116"
    },
    "tables": [
      {
        "caption": "Table 2-3: Skills",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "+8",
            "+5",
            "+4",
            "+2 to +1"
          ],
          [
            "0",
            "+9",
            "+6",
            "+5",
            "+3 to +2"
          ],
          [
            "1",
            "+10",
            "+7",
            "+6",
            "+4 to +3"
          ],
          [
            "2",
            "+11",
            "+8",
            "+7",
            "+5 to +4"
          ],
          [
            "3",
            "+13",
            "+10",
            "+9",
            "+7 to +5"
          ],
          [
            "4",
            "+15",
            "+12",
            "+10",
            "+8 to +7"
          ],
          [
            "5",
            "+16",
            "+13",
            "+12",
            "+10 to +8"
          ],
          [
            "6",
            "+18",
            "+15",
            "+13",
            "+11 to +9"
          ],
          [
            "7",
            "+20",
            "+17",
            "+15",
            "+13 to +11"
          ],
          [
            "8",
            "+21",
            "+18",
            "+16",
            "+14 to +12"
          ],
          [
            "9",
            "+23",
            "+20",
            "+18",
            "+16 to +13"
          ],
          [
            "10",
            "+25",
            "+22",
            "+19",
            "+17 to +15"
          ],
          [
            "11",
            "+26",
            "+23",
            "+21",
            "+19 to +16"
          ],
          [
            "12",
            "+28",
            "+25",
            "+22",
            "+20 to +17"
          ],
          [
            "13",
            "+30",
            "+27",
            "+24",
            "+22 to +19"
          ],
          [
            "14",
            "+31",
            "+28",
            "+25",
            "+23 to +20"
          ],
          [
            "15",
            "+33",
            "+30",
            "+27",
            "+25 to +21"
          ],
          [
            "16",
            "+35",
            "+32",
            "+28",
            "+26 to +23"
          ],
          [
            "17",
            "+36",
            "+33",
            "+30",
            "+28 to +24"
          ],
          [
            "18",
            "+38",
            "+35",
            "+31",
            "+29 to +25"
          ],
          [
            "19",
            "+40",
            "+37",
            "+33",
            "+31 to +27"
          ],
          [
            "20",
            "+41",
            "+38",
            "+34",
            "+32 to +28"
          ],
          [
            "21",
            "+43",
            "+40",
            "+36",
            "+34 to +29"
          ],
          [
            "22",
            "+45",
            "+42",
            "+37",
            "+35 to +31"
          ],
          [
            "23",
            "+46",
            "+43",
            "+38",
            "+36 to +32"
          ],
          [
            "24",
            "+48",
            "+45",
            "+40",
            "+38 to +33"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": 9,
            "high": 6,
            "moderate": 5,
            "low": "+3 to +2"
          },
          "1": {
            "extreme": 10,
            "high": 7,
            "moderate": 6,
            "low": "+4 to +3"
          },
          "2": {
            "extreme": 11,
            "high": 8,
            "moderate": 7,
            "low": "+5 to +4"
          },
          "3": {
            "extreme": 13,
            "high": 10,
            "moderate": 9,
            "low": "+7 to +5"
          },
          "4": {
            "extreme": 15,
            "high": 12,
            "moderate": 10,
            "low": "+8 to +7"
          },
          "5": {
            "extreme": 16,
            "high": 13,
            "moderate": 12,
            "low": "+10 to +8"
          },
          "6": {
            "extreme": 18,
            "high": 15,
            "moderate": 13,
            "low": "+11 to +9"
          },
          "7": {
            "extreme": 20,
            "high": 17,
            "moderate": 15,
            "low": "+13 to +11"
          },
          "8": {
            "extreme": 21,
            "high": 18,
            "moderate": 16,
            "low": "+14 to +12"
          },
          "9": {
            "extreme": 23,
            "high": 20,
            "moderate": 18,
            "low": "+16 to +13"
          },
          "10": {
            "extreme": 25,
            "high": 22,
            "moderate": 19,
            "low": "+17 to +15"
          },
          "11": {
            "extreme": 26,
            "high": 23,
            "moderate": 21,
            "low": "+19 to +16"
          },
          "12": {
            "extreme": 28,
            "high": 25,
            "moderate": 22,
            "low": "+20 to +17"
          },
          "13": {
            "extreme": 30,
            "high": 27,
            "moderate": 24,
            "low": "+22 to +19"
          },
          "14": {
            "extreme": 31,
            "high": 28,
            "moderate": 25,
            "low": "+23 to +20"
          },
          "15": {
            "extreme": 33,
            "high": 30,
            "moderate": 27,
            "low": "+25 to +21"
          },
          "16": {
            "extreme": 35,
            "high": 32,
            "moderate": 28,
            "low": "+26 to +23"
          },
          "17": {
            "extreme": 36,
            "high": 33,
            "moderate": 30,
            "low": "+28 to +24"
          },
          "18": {
            "extreme": 38,
            "high": 35,
            "moderate": 31,
            "low": "+29 to +25"
          },
          "19": {
            "extreme": 40,
            "high": 37,
            "moderate": 33,
            "low": "+31 to +27"
          },
          "20": {
            "extreme": 41,
            "high": 38,
            "moderate": 34,
            "low": "+32 to +28"
          },
          "21": {
            "extreme": 43,
            "high": 40,
            "moderate": 36,
            "low": "+34 to +29"
          },
          "22": {
            "extreme": 45,
            "high": 42,
            "moderate": 37,
            "low": "+35 to +31"
          },
          "23": {
            "extreme": 46,
            "high": 43,
            "moderate": 38,
            "low": "+36 to +32"
          },
          "24": {
            "extreme": 48,
            "high": 45,
            "moderate": 40,
            "low": "+38 to +33"
          },
          "-1": {
            "extreme": 8,
            "high": 5,
            "moderate": 4,
            "low": "+2 to +1"
          }
        }
      }
    ]
  },
  "safeItems": {
    "source": {
      "id": "rules-2887",
      "name": "Items",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 116"
    },
    "tables": [
      {
        "caption": "Table 2-4: Safe Items",
        "columns": [
          "Creature Level",
          "Safe Item Level"
        ],
        "rows": [
          [
            "3 or lower",
            "0"
          ],
          [
            "4-5",
            "1"
          ],
          [
            "6",
            "2 (_+1 weapon_)"
          ],
          [
            "7",
            "3"
          ],
          [
            "8",
            "4 (_+1 striking weapon_)"
          ],
          [
            "9",
            "5 (_+1 armor_)"
          ],
          [
            "10",
            "6"
          ],
          [
            "11",
            "7"
          ],
          [
            "12",
            "8 (_+1 resilient armor_)"
          ],
          [
            "13",
            "9"
          ],
          [
            "14",
            "10 (_+2 striking weapon_)"
          ],
          [
            "15",
            "11 (_+2 resilient armor_)"
          ],
          [
            "16",
            "12 (_+2 greater striking weapon_)"
          ],
          [
            "17",
            "13"
          ],
          [
            "18",
            "14 (_+2 greater resilient armor_)"
          ],
          [
            "19",
            "15"
          ],
          [
            "20",
            "16 (_+3 greater striking weapon_)"
          ],
          [
            "21",
            "17"
          ],
          [
            "22",
            "18 (_+3 greater resilient armor_)"
          ],
          [
            "23",
            "19 (_+3 major striking weapon_)"
          ],
          [
            "24",
            "20 (_+3 major resilient armor_)"
          ]
        ],
        "byLevel": {
          "6": {
            "safe item level": "2 (_+1 weapon_)"
          },
          "7": {
            "safe item level": 3
          },
          "8": {
            "safe item level": "4 (_+1 striking weapon_)"
          },
          "9": {
            "safe item level": "5 (_+1 armor_)"
          },
          "10": {
            "safe item level": 6
          },
          "11": {
            "safe item level": 7
          },
          "12": {
            "safe item level": "8 (_+1 resilient armor_)"
          },
          "13": {
            "safe item level": 9
          },
          "14": {
            "safe item level": "10 (_+2 striking weapon_)"
          },
          "15": {
            "safe item level": "11 (_+2 resilient armor_)"
          },
          "16": {
            "safe item level": "12 (_+2 greater striking weapon_)"
          },
          "17": {
            "safe item level": 13
          },
          "18": {
            "safe item level": "14 (_+2 greater resilient armor_)"
          },
          "19": {
            "safe item level": 15
          },
          "20": {
            "safe item level": "16 (_+3 greater striking weapon_)"
          },
          "21": {
            "safe item level": 17
          },
          "22": {
            "safe item level": "18 (_+3 greater resilient armor_)"
          },
          "23": {
            "safe item level": "19 (_+3 major striking weapon_)"
          },
          "24": {
            "safe item level": "20 (_+3 major resilient armor_)"
          }
        }
      }
    ]
  },
  "armorClass": {
    "source": {
      "id": "rules-2889",
      "name": "Armor Class",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 117"
    },
    "tables": [
      {
        "caption": "Table 2-5: Armor Class",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "18",
            "15",
            "14",
            "12"
          ],
          [
            "0",
            "19",
            "16",
            "15",
            "13"
          ],
          [
            "1",
            "19",
            "16",
            "15",
            "13"
          ],
          [
            "2",
            "21",
            "18",
            "17",
            "15"
          ],
          [
            "3",
            "22",
            "19",
            "18",
            "16"
          ],
          [
            "4",
            "24",
            "21",
            "20",
            "18"
          ],
          [
            "5",
            "25",
            "22",
            "21",
            "19"
          ],
          [
            "6",
            "27",
            "24",
            "23",
            "21"
          ],
          [
            "7",
            "28",
            "25",
            "24",
            "22"
          ],
          [
            "8",
            "30",
            "27",
            "26",
            "24"
          ],
          [
            "9",
            "31",
            "28",
            "27",
            "25"
          ],
          [
            "10",
            "33",
            "30",
            "29",
            "27"
          ],
          [
            "11",
            "34",
            "31",
            "30",
            "28"
          ],
          [
            "12",
            "36",
            "33",
            "32",
            "30"
          ],
          [
            "13",
            "37",
            "34",
            "33",
            "31"
          ],
          [
            "14",
            "39",
            "36",
            "35",
            "33"
          ],
          [
            "15",
            "40",
            "37",
            "36",
            "34"
          ],
          [
            "16",
            "42",
            "39",
            "38",
            "36"
          ],
          [
            "17",
            "43",
            "40",
            "39",
            "37"
          ],
          [
            "18",
            "45",
            "42",
            "41",
            "39"
          ],
          [
            "19",
            "46",
            "43",
            "42",
            "40"
          ],
          [
            "20",
            "48",
            "45",
            "44",
            "42"
          ],
          [
            "21",
            "49",
            "46",
            "45",
            "43"
          ],
          [
            "22",
            "51",
            "48",
            "47",
            "45"
          ],
          [
            "23",
            "52",
            "49",
            "48",
            "46"
          ],
          [
            "24",
            "54",
            "51",
            "50",
            "48"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": 19,
            "high": 16,
            "moderate": 15,
            "low": 13
          },
          "1": {
            "extreme": 19,
            "high": 16,
            "moderate": 15,
            "low": 13
          },
          "2": {
            "extreme": 21,
            "high": 18,
            "moderate": 17,
            "low": 15
          },
          "3": {
            "extreme": 22,
            "high": 19,
            "moderate": 18,
            "low": 16
          },
          "4": {
            "extreme": 24,
            "high": 21,
            "moderate": 20,
            "low": 18
          },
          "5": {
            "extreme": 25,
            "high": 22,
            "moderate": 21,
            "low": 19
          },
          "6": {
            "extreme": 27,
            "high": 24,
            "moderate": 23,
            "low": 21
          },
          "7": {
            "extreme": 28,
            "high": 25,
            "moderate": 24,
            "low": 22
          },
          "8": {
            "extreme": 30,
            "high": 27,
            "moderate": 26,
            "low": 24
          },
          "9": {
            "extreme": 31,
            "high": 28,
            "moderate": 27,
            "low": 25
          },
          "10": {
            "extreme": 33,
            "high": 30,
            "moderate": 29,
            "low": 27
          },
          "11": {
            "extreme": 34,
            "high": 31,
            "moderate": 30,
            "low": 28
          },
          "12": {
            "extreme": 36,
            "high": 33,
            "moderate": 32,
            "low": 30
          },
          "13": {
            "extreme": 37,
            "high": 34,
            "moderate": 33,
            "low": 31
          },
          "14": {
            "extreme": 39,
            "high": 36,
            "moderate": 35,
            "low": 33
          },
          "15": {
            "extreme": 40,
            "high": 37,
            "moderate": 36,
            "low": 34
          },
          "16": {
            "extreme": 42,
            "high": 39,
            "moderate": 38,
            "low": 36
          },
          "17": {
            "extreme": 43,
            "high": 40,
            "moderate": 39,
            "low": 37
          },
          "18": {
            "extreme": 45,
            "high": 42,
            "moderate": 41,
            "low": 39
          },
          "19": {
            "extreme": 46,
            "high": 43,
            "moderate": 42,
            "low": 40
          },
          "20": {
            "extreme": 48,
            "high": 45,
            "moderate": 44,
            "low": 42
          },
          "21": {
            "extreme": 49,
            "high": 46,
            "moderate": 45,
            "low": 43
          },
          "22": {
            "extreme": 51,
            "high": 48,
            "moderate": 47,
            "low": 45
          },
          "23": {
            "extreme": 52,
            "high": 49,
            "moderate": 48,
            "low": 46
          },
          "24": {
            "extreme": 54,
            "high": 51,
            "moderate": 50,
            "low": 48
          },
          "-1": {
            "extreme": 18,
            "high": 15,
            "moderate": 14,
            "low": 12
          }
        }
      }
    ]
  },
  "savingThrows": {
    "source": {
      "id": "rules-2890",
      "name": "Saving Throws",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 118"
    },
    "tables": [
      {
        "caption": "Table 2-6: Saving Throws",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low",
          "Terrible"
        ],
        "rows": [
          [
            "-1",
            "+9",
            "+8",
            "+5",
            "+2",
            "+0"
          ],
          [
            "0",
            "+10",
            "+9",
            "+6",
            "+3",
            "+1"
          ],
          [
            "1",
            "+11",
            "+10",
            "+7",
            "+4",
            "+2"
          ],
          [
            "2",
            "+12",
            "+11",
            "+8",
            "+5",
            "+3"
          ],
          [
            "3",
            "+14",
            "+12",
            "+9",
            "+6",
            "+4"
          ],
          [
            "4",
            "+15",
            "+14",
            "+11",
            "+8",
            "+6"
          ],
          [
            "5",
            "+17",
            "+15",
            "+12",
            "+9",
            "+7"
          ],
          [
            "6",
            "+18",
            "+17",
            "+14",
            "+11",
            "+8"
          ],
          [
            "7",
            "+20",
            "+18",
            "+15",
            "+12",
            "+10"
          ],
          [
            "8",
            "+21",
            "+19",
            "+16",
            "+13",
            "+11"
          ],
          [
            "9",
            "+23",
            "+21",
            "+18",
            "+15",
            "+12"
          ],
          [
            "10",
            "+24",
            "+22",
            "+19",
            "+16",
            "+14"
          ],
          [
            "11",
            "+26",
            "+24",
            "+21",
            "+18",
            "+15"
          ],
          [
            "12",
            "+27",
            "+25",
            "+22",
            "+19",
            "+16"
          ],
          [
            "13",
            "+29",
            "+26",
            "+23",
            "+20",
            "+18"
          ],
          [
            "14",
            "+30",
            "+28",
            "+25",
            "+22",
            "+19"
          ],
          [
            "15",
            "+32",
            "+29",
            "+26",
            "+23",
            "+20"
          ],
          [
            "16",
            "+33",
            "+30",
            "+28",
            "+25",
            "+22"
          ],
          [
            "17",
            "+35",
            "+32",
            "+29",
            "+26",
            "+23"
          ],
          [
            "18",
            "+36",
            "+33",
            "+30",
            "+27",
            "+24"
          ],
          [
            "19",
            "+38",
            "+35",
            "+32",
            "+29",
            "+26"
          ],
          [
            "20",
            "+39",
            "+36",
            "+33",
            "+30",
            "+27"
          ],
          [
            "21",
            "+41",
            "+38",
            "+35",
            "+32",
            "+28"
          ],
          [
            "22",
            "+43",
            "+39",
            "+36",
            "+33",
            "+30"
          ],
          [
            "23",
            "+44",
            "+40",
            "+37",
            "+34",
            "+31"
          ],
          [
            "24",
            "+46",
            "+42",
            "+38",
            "+36",
            "+32"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": 10,
            "high": 9,
            "moderate": 6,
            "low": 3,
            "terrible": 1
          },
          "1": {
            "extreme": 11,
            "high": 10,
            "moderate": 7,
            "low": 4,
            "terrible": 2
          },
          "2": {
            "extreme": 12,
            "high": 11,
            "moderate": 8,
            "low": 5,
            "terrible": 3
          },
          "3": {
            "extreme": 14,
            "high": 12,
            "moderate": 9,
            "low": 6,
            "terrible": 4
          },
          "4": {
            "extreme": 15,
            "high": 14,
            "moderate": 11,
            "low": 8,
            "terrible": 6
          },
          "5": {
            "extreme": 17,
            "high": 15,
            "moderate": 12,
            "low": 9,
            "terrible": 7
          },
          "6": {
            "extreme": 18,
            "high": 17,
            "moderate": 14,
            "low": 11,
            "terrible": 8
          },
          "7": {
            "extreme": 20,
            "high": 18,
            "moderate": 15,
            "low": 12,
            "terrible": 10
          },
          "8": {
            "extreme": 21,
            "high": 19,
            "moderate": 16,
            "low": 13,
            "terrible": 11
          },
          "9": {
            "extreme": 23,
            "high": 21,
            "moderate": 18,
            "low": 15,
            "terrible": 12
          },
          "10": {
            "extreme": 24,
            "high": 22,
            "moderate": 19,
            "low": 16,
            "terrible": 14
          },
          "11": {
            "extreme": 26,
            "high": 24,
            "moderate": 21,
            "low": 18,
            "terrible": 15
          },
          "12": {
            "extreme": 27,
            "high": 25,
            "moderate": 22,
            "low": 19,
            "terrible": 16
          },
          "13": {
            "extreme": 29,
            "high": 26,
            "moderate": 23,
            "low": 20,
            "terrible": 18
          },
          "14": {
            "extreme": 30,
            "high": 28,
            "moderate": 25,
            "low": 22,
            "terrible": 19
          },
          "15": {
            "extreme": 32,
            "high": 29,
            "moderate": 26,
            "low": 23,
            "terrible": 20
          },
          "16": {
            "extreme": 33,
            "high": 30,
            "moderate": 28,
            "low": 25,
            "terrible": 22
          },
          "17": {
            "extreme": 35,
            "high": 32,
            "moderate": 29,
            "low": 26,
            "terrible": 23
          },
          "18": {
            "extreme": 36,
            "high": 33,
            "moderate": 30,
            "low": 27,
            "terrible": 24
          },
          "19": {
            "extreme": 38,
            "high": 35,
            "moderate": 32,
            "low": 29,
            "terrible": 26
          },
          "20": {
            "extreme": 39,
            "high": 36,
            "moderate": 33,
            "low": 30,
            "terrible": 27
          },
          "21": {
            "extreme": 41,
            "high": 38,
            "moderate": 35,
            "low": 32,
            "terrible": 28
          },
          "22": {
            "extreme": 43,
            "high": 39,
            "moderate": 36,
            "low": 33,
            "terrible": 30
          },
          "23": {
            "extreme": 44,
            "high": 40,
            "moderate": 37,
            "low": 34,
            "terrible": 31
          },
          "24": {
            "extreme": 46,
            "high": 42,
            "moderate": 38,
            "low": 36,
            "terrible": 32
          },
          "-1": {
            "extreme": 9,
            "high": 8,
            "moderate": 5,
            "low": 2,
            "terrible": 0
          }
        }
      }
    ]
  },
  "hitPoints": {
    "source": {
      "id": "rules-2891",
      "name": "Hit Points",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 118"
    },
    "tables": [
      {
        "caption": "Table 2-7: Hit Points",
        "columns": [
          "Level",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "9",
            "8-7",
            "6-5"
          ],
          [
            "0",
            "20-17",
            "16-14",
            "13-11"
          ],
          [
            "1",
            "26-24",
            "21-19",
            "16-14"
          ],
          [
            "2",
            "40-36",
            "32-28",
            "25-21"
          ],
          [
            "3",
            "59-53",
            "48-42",
            "37-31"
          ],
          [
            "4",
            "78-72",
            "63-57",
            "48-42"
          ],
          [
            "5",
            "97-91",
            "78-72",
            "59-53"
          ],
          [
            "6",
            "123-115",
            "99-91",
            "75-67"
          ],
          [
            "7",
            "148-140",
            "119-111",
            "90-82"
          ],
          [
            "8",
            "173-165",
            "139-131",
            "105-97"
          ],
          [
            "9",
            "198-190",
            "159-151",
            "120-112"
          ],
          [
            "10",
            "223-215",
            "179-171",
            "135-127"
          ],
          [
            "11",
            "248-240",
            "199-191",
            "150-142"
          ],
          [
            "12",
            "273-265",
            "219-211",
            "165-157"
          ],
          [
            "13",
            "298-290",
            "239-231",
            "180-172"
          ],
          [
            "14",
            "323-315",
            "259-251",
            "195-187"
          ],
          [
            "15",
            "348-340",
            "279-271",
            "210-202"
          ],
          [
            "16",
            "373-365",
            "299-291",
            "225-217"
          ],
          [
            "17",
            "398-390",
            "319-311",
            "240-232"
          ],
          [
            "18",
            "423-415",
            "339-331",
            "255-247"
          ],
          [
            "19",
            "448-440",
            "359-351",
            "270-262"
          ],
          [
            "20",
            "473-465",
            "379-371",
            "285-277"
          ],
          [
            "21",
            "505-495",
            "405-395",
            "305-295"
          ],
          [
            "22",
            "544-532",
            "436-424",
            "329-317"
          ],
          [
            "23",
            "581-569",
            "466-454",
            "351-339"
          ],
          [
            "24",
            "633-617",
            "508-492",
            "383-367"
          ]
        ],
        "byLevel": {
          "0": {
            "high": "20-17",
            "moderate": "16-14",
            "low": "13-11"
          },
          "1": {
            "high": "26-24",
            "moderate": "21-19",
            "low": "16-14"
          },
          "2": {
            "high": "40-36",
            "moderate": "32-28",
            "low": "25-21"
          },
          "3": {
            "high": "59-53",
            "moderate": "48-42",
            "low": "37-31"
          },
          "4": {
            "high": "78-72",
            "moderate": "63-57",
            "low": "48-42"
          },
          "5": {
            "high": "97-91",
            "moderate": "78-72",
            "low": "59-53"
          },
          "6": {
            "high": "123-115",
            "moderate": "99-91",
            "low": "75-67"
          },
          "7": {
            "high": "148-140",
            "moderate": "119-111",
            "low": "90-82"
          },
          "8": {
            "high": "173-165",
            "moderate": "139-131",
            "low": "105-97"
          },
          "9": {
            "high": "198-190",
            "moderate": "159-151",
            "low": "120-112"
          },
          "10": {
            "high": "223-215",
            "moderate": "179-171",
            "low": "135-127"
          },
          "11": {
            "high": "248-240",
            "moderate": "199-191",
            "low": "150-142"
          },
          "12": {
            "high": "273-265",
            "moderate": "219-211",
            "low": "165-157"
          },
          "13": {
            "high": "298-290",
            "moderate": "239-231",
            "low": "180-172"
          },
          "14": {
            "high": "323-315",
            "moderate": "259-251",
            "low": "195-187"
          },
          "15": {
            "high": "348-340",
            "moderate": "279-271",
            "low": "210-202"
          },
          "16": {
            "high": "373-365",
            "moderate": "299-291",
            "low": "225-217"
          },
          "17": {
            "high": "398-390",
            "moderate": "319-311",
            "low": "240-232"
          },
          "18": {
            "high": "423-415",
            "moderate": "339-331",
            "low": "255-247"
          },
          "19": {
            "high": "448-440",
            "moderate": "359-351",
            "low": "270-262"
          },
          "20": {
            "high": "473-465",
            "moderate": "379-371",
            "low": "285-277"
          },
          "21": {
            "high": "505-495",
            "moderate": "405-395",
            "low": "305-295"
          },
          "22": {
            "high": "544-532",
            "moderate": "436-424",
            "low": "329-317"
          },
          "23": {
            "high": "581-569",
            "moderate": "466-454",
            "low": "351-339"
          },
          "24": {
            "high": "633-617",
            "moderate": "508-492",
            "low": "383-367"
          },
          "-1": {
            "high": 9,
            "moderate": "8-7",
            "low": "6-5"
          }
        }
      }
    ]
  },
  "weaknessesResistances": {
    "source": {
      "id": "rules-2893",
      "name": "Immunities, Weaknesses, and Resistances",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 119"
    },
    "tables": [
      {
        "caption": "Table 2-8: Resistances and Weaknesses",
        "columns": [
          "Level",
          "Maximum",
          "Minimum"
        ],
        "rows": [
          [
            "-1",
            "1",
            "1"
          ],
          [
            "0",
            "3",
            "1"
          ],
          [
            "1",
            "3",
            "2"
          ],
          [
            "2",
            "5",
            "2"
          ],
          [
            "3",
            "6",
            "3"
          ],
          [
            "4",
            "7",
            "4"
          ],
          [
            "5",
            "8",
            "4"
          ],
          [
            "6",
            "9",
            "5"
          ],
          [
            "7",
            "10",
            "5"
          ],
          [
            "8",
            "11",
            "6"
          ],
          [
            "9",
            "12",
            "6"
          ],
          [
            "10",
            "13",
            "7"
          ],
          [
            "11",
            "14",
            "7"
          ],
          [
            "12",
            "15",
            "8"
          ],
          [
            "13",
            "16",
            "8"
          ],
          [
            "14",
            "17",
            "9"
          ],
          [
            "15",
            "18",
            "9"
          ],
          [
            "16",
            "19",
            "9"
          ],
          [
            "17",
            "19",
            "10"
          ],
          [
            "18",
            "20",
            "10"
          ],
          [
            "19",
            "21",
            "11"
          ],
          [
            "20",
            "22",
            "11"
          ],
          [
            "21",
            "23",
            "12"
          ],
          [
            "22",
            "24",
            "12"
          ],
          [
            "23",
            "25",
            "13"
          ],
          [
            "24",
            "26",
            "13"
          ]
        ],
        "byLevel": {
          "0": {
            "maximum": 3,
            "minimum": 1
          },
          "1": {
            "maximum": 3,
            "minimum": 2
          },
          "2": {
            "maximum": 5,
            "minimum": 2
          },
          "3": {
            "maximum": 6,
            "minimum": 3
          },
          "4": {
            "maximum": 7,
            "minimum": 4
          },
          "5": {
            "maximum": 8,
            "minimum": 4
          },
          "6": {
            "maximum": 9,
            "minimum": 5
          },
          "7": {
            "maximum": 10,
            "minimum": 5
          },
          "8": {
            "maximum": 11,
            "minimum": 6
          },
          "9": {
            "maximum": 12,
            "minimum": 6
          },
          "10": {
            "maximum": 13,
            "minimum": 7
          },
          "11": {
            "maximum": 14,
            "minimum": 7
          },
          "12": {
            "maximum": 15,
            "minimum": 8
          },
          "13": {
            "maximum": 16,
            "minimum": 8
          },
          "14": {
            "maximum": 17,
            "minimum": 9
          },
          "15": {
            "maximum": 18,
            "minimum": 9
          },
          "16": {
            "maximum": 19,
            "minimum": 9
          },
          "17": {
            "maximum": 19,
            "minimum": 10
          },
          "18": {
            "maximum": 20,
            "minimum": 10
          },
          "19": {
            "maximum": 21,
            "minimum": 11
          },
          "20": {
            "maximum": 22,
            "minimum": 11
          },
          "21": {
            "maximum": 23,
            "minimum": 12
          },
          "22": {
            "maximum": 24,
            "minimum": 12
          },
          "23": {
            "maximum": 25,
            "minimum": 13
          },
          "24": {
            "maximum": 26,
            "minimum": 13
          },
          "-1": {
            "maximum": 1,
            "minimum": 1
          }
        }
      }
    ]
  },
  "strikeAttackBonus": {
    "source": {
      "id": "rules-2896",
      "name": "Strike Attack Bonus",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 120"
    },
    "tables": [
      {
        "caption": "Table 2-9: Strike Attack Bonus",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "+10",
            "+8",
            "+6",
            "+4"
          ],
          [
            "0",
            "+10",
            "+8",
            "+6",
            "+4"
          ],
          [
            "1",
            "+11",
            "+9",
            "+7",
            "+5"
          ],
          [
            "2",
            "+13",
            "+11",
            "+9",
            "+7"
          ],
          [
            "3",
            "+14",
            "+12",
            "+10",
            "+8"
          ],
          [
            "4",
            "+16",
            "+14",
            "+12",
            "+9"
          ],
          [
            "5",
            "+17",
            "+15",
            "+13",
            "+11"
          ],
          [
            "6",
            "+19",
            "+17",
            "+15",
            "+12"
          ],
          [
            "7",
            "+20",
            "+18",
            "+16",
            "+13"
          ],
          [
            "8",
            "+22",
            "+20",
            "+18",
            "+15"
          ],
          [
            "9",
            "+23",
            "+21",
            "+19",
            "+16"
          ],
          [
            "10",
            "+25",
            "+23",
            "+21",
            "+17"
          ],
          [
            "11",
            "+27",
            "+24",
            "+22",
            "+19"
          ],
          [
            "12",
            "+28",
            "+26",
            "+24",
            "+20"
          ],
          [
            "13",
            "+29",
            "+27",
            "+25",
            "+21"
          ],
          [
            "14",
            "+31",
            "+29",
            "+27",
            "+23"
          ],
          [
            "15",
            "+32",
            "+30",
            "+28",
            "+24"
          ],
          [
            "16",
            "+34",
            "+32",
            "+30",
            "+25"
          ],
          [
            "17",
            "+35",
            "+33",
            "+31",
            "+27"
          ],
          [
            "18",
            "+37",
            "+35",
            "+33",
            "+28"
          ],
          [
            "19",
            "+38",
            "+36",
            "+34",
            "+29"
          ],
          [
            "20",
            "+40",
            "+38",
            "+36",
            "+31"
          ],
          [
            "21",
            "+41",
            "+39",
            "+37",
            "+32"
          ],
          [
            "22",
            "+43",
            "+41",
            "+39",
            "+33"
          ],
          [
            "23",
            "+44",
            "+42",
            "+40",
            "+35"
          ],
          [
            "24",
            "+46",
            "+44",
            "+42",
            "+36"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": 10,
            "high": 8,
            "moderate": 6,
            "low": 4
          },
          "1": {
            "extreme": 11,
            "high": 9,
            "moderate": 7,
            "low": 5
          },
          "2": {
            "extreme": 13,
            "high": 11,
            "moderate": 9,
            "low": 7
          },
          "3": {
            "extreme": 14,
            "high": 12,
            "moderate": 10,
            "low": 8
          },
          "4": {
            "extreme": 16,
            "high": 14,
            "moderate": 12,
            "low": 9
          },
          "5": {
            "extreme": 17,
            "high": 15,
            "moderate": 13,
            "low": 11
          },
          "6": {
            "extreme": 19,
            "high": 17,
            "moderate": 15,
            "low": 12
          },
          "7": {
            "extreme": 20,
            "high": 18,
            "moderate": 16,
            "low": 13
          },
          "8": {
            "extreme": 22,
            "high": 20,
            "moderate": 18,
            "low": 15
          },
          "9": {
            "extreme": 23,
            "high": 21,
            "moderate": 19,
            "low": 16
          },
          "10": {
            "extreme": 25,
            "high": 23,
            "moderate": 21,
            "low": 17
          },
          "11": {
            "extreme": 27,
            "high": 24,
            "moderate": 22,
            "low": 19
          },
          "12": {
            "extreme": 28,
            "high": 26,
            "moderate": 24,
            "low": 20
          },
          "13": {
            "extreme": 29,
            "high": 27,
            "moderate": 25,
            "low": 21
          },
          "14": {
            "extreme": 31,
            "high": 29,
            "moderate": 27,
            "low": 23
          },
          "15": {
            "extreme": 32,
            "high": 30,
            "moderate": 28,
            "low": 24
          },
          "16": {
            "extreme": 34,
            "high": 32,
            "moderate": 30,
            "low": 25
          },
          "17": {
            "extreme": 35,
            "high": 33,
            "moderate": 31,
            "low": 27
          },
          "18": {
            "extreme": 37,
            "high": 35,
            "moderate": 33,
            "low": 28
          },
          "19": {
            "extreme": 38,
            "high": 36,
            "moderate": 34,
            "low": 29
          },
          "20": {
            "extreme": 40,
            "high": 38,
            "moderate": 36,
            "low": 31
          },
          "21": {
            "extreme": 41,
            "high": 39,
            "moderate": 37,
            "low": 32
          },
          "22": {
            "extreme": 43,
            "high": 41,
            "moderate": 39,
            "low": 33
          },
          "23": {
            "extreme": 44,
            "high": 42,
            "moderate": 40,
            "low": 35
          },
          "24": {
            "extreme": 46,
            "high": 44,
            "moderate": 42,
            "low": 36
          },
          "-1": {
            "extreme": 10,
            "high": 8,
            "moderate": 6,
            "low": 4
          }
        }
      }
    ]
  },
  "strikeDamage": {
    "source": {
      "id": "rules-2897",
      "name": "Strike Damage",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 120"
    },
    "tables": [
      {
        "caption": "Table 2-10: Strike Damage",
        "columns": [
          "Level",
          "Extreme",
          "High",
          "Moderate",
          "Low"
        ],
        "rows": [
          [
            "-1",
            "1d6+1 (4)",
            "1d4+1 (3)",
            "1d4 (3)",
            "1d4 (2)"
          ],
          [
            "0",
            "1d6+3 (6)",
            "1d6+2 (5)",
            "1d4+2 (4)",
            "1d4+1 (3)"
          ],
          [
            "1",
            "1d8+4 (8)",
            "1d6+3 (6)",
            "1d6+2 (5)",
            "1d4+2 (4)"
          ],
          [
            "2",
            "1d12+4 (11)",
            "1d10+4 (9)",
            "1d8+4 (8)",
            "1d6+3 (6)"
          ],
          [
            "3",
            "1d12+8 (15)",
            "1d10+6 (12)",
            "1d8+6 (10)",
            "1d6+5 (8)"
          ],
          [
            "4",
            "2d10+7 (18)",
            "2d8+5 (14)",
            "2d6+5 (12)",
            "2d4+4 (9)"
          ],
          [
            "5",
            "2d12+7 (20)",
            "2d8+7 (16)",
            "2d6+6 (13)",
            "2d4+6 (11)"
          ],
          [
            "6",
            "2d12+10 (23)",
            "2d8+9 (18)",
            "2d6+8 (15)",
            "2d4+7 (12)"
          ],
          [
            "7",
            "2d12+12 (25)",
            "2d10+9 (20)",
            "2d8+8 (17)",
            "2d6+6 (13)"
          ],
          [
            "8",
            "2d12+15 (28)",
            "2d10+11 (22)",
            "2d8+9 (18)",
            "2d6+8 (15)"
          ],
          [
            "9",
            "2d12+17 (30)",
            "2d10+13 (24)",
            "2d8+11 (20)",
            "2d6+9 (16)"
          ],
          [
            "10",
            "2d12+20 (33)",
            "2d12+13 (26)",
            "2d10+11 (22)",
            "2d6+10 (17)"
          ],
          [
            "11",
            "2d12+22 (35)",
            "2d12+15 (28)",
            "2d10+12 (23)",
            "2d8+10 (19)"
          ],
          [
            "12",
            "3d12+19 (38)",
            "3d10+14 (30)",
            "3d8+12 (25)",
            "3d6+10 (20)"
          ],
          [
            "13",
            "3d12+21 (40)",
            "3d10+16 (32)",
            "3d8+14 (27)",
            "3d6+11 (21)"
          ],
          [
            "14",
            "3d12+24 (43)",
            "3d10+18 (34)",
            "3d8+15 (28)",
            "3d6+13 (23)"
          ],
          [
            "15",
            "3d12+26 (45)",
            "3d12+17 (36)",
            "3d10+14 (30)",
            "3d6+14 (24)"
          ],
          [
            "16",
            "3d12+29 (48)",
            "3d12+18 (37)",
            "3d10+15 (31)",
            "3d6+15 (25)"
          ],
          [
            "17",
            "3d12+31 (50)",
            "3d12+19 (38)",
            "3d10+16 (32)",
            "3d6+16 (26)"
          ],
          [
            "18",
            "3d12+34 (53)",
            "3d12+20 (40)",
            "3d10+17 (33)",
            "3d6+17 (27)"
          ],
          [
            "19",
            "4d12+29 (55)",
            "4d10+20 (42)",
            "4d8+17 (35)",
            "4d6+14 (28)"
          ],
          [
            "20",
            "4d12+32 (58)",
            "4d10+22 (44)",
            "4d8+19 (37)",
            "4d6+15 (29)"
          ],
          [
            "21",
            "4d12+34 (60)",
            "4d10+24 (46)",
            "4d8+20 (38)",
            "4d6+17 (31)"
          ],
          [
            "22",
            "4d12+37 (63)",
            "4d10+26 (48)",
            "4d8+22 (40)",
            "4d6+18 (32)"
          ],
          [
            "23",
            "4d12+39 (65)",
            "4d12+24 (50)",
            "4d10+20 (42)",
            "4d6+19 (33)"
          ],
          [
            "24",
            "4d12+42 (68)",
            "4d12+26 (52)",
            "4d10+22 (44)",
            "4d6+21 (35)"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme": "1d6+3 (6)",
            "high": "1d6+2 (5)",
            "moderate": "1d4+2 (4)",
            "low": "1d4+1 (3)"
          },
          "1": {
            "extreme": "1d8+4 (8)",
            "high": "1d6+3 (6)",
            "moderate": "1d6+2 (5)",
            "low": "1d4+2 (4)"
          },
          "2": {
            "extreme": "1d12+4 (11)",
            "high": "1d10+4 (9)",
            "moderate": "1d8+4 (8)",
            "low": "1d6+3 (6)"
          },
          "3": {
            "extreme": "1d12+8 (15)",
            "high": "1d10+6 (12)",
            "moderate": "1d8+6 (10)",
            "low": "1d6+5 (8)"
          },
          "4": {
            "extreme": "2d10+7 (18)",
            "high": "2d8+5 (14)",
            "moderate": "2d6+5 (12)",
            "low": "2d4+4 (9)"
          },
          "5": {
            "extreme": "2d12+7 (20)",
            "high": "2d8+7 (16)",
            "moderate": "2d6+6 (13)",
            "low": "2d4+6 (11)"
          },
          "6": {
            "extreme": "2d12+10 (23)",
            "high": "2d8+9 (18)",
            "moderate": "2d6+8 (15)",
            "low": "2d4+7 (12)"
          },
          "7": {
            "extreme": "2d12+12 (25)",
            "high": "2d10+9 (20)",
            "moderate": "2d8+8 (17)",
            "low": "2d6+6 (13)"
          },
          "8": {
            "extreme": "2d12+15 (28)",
            "high": "2d10+11 (22)",
            "moderate": "2d8+9 (18)",
            "low": "2d6+8 (15)"
          },
          "9": {
            "extreme": "2d12+17 (30)",
            "high": "2d10+13 (24)",
            "moderate": "2d8+11 (20)",
            "low": "2d6+9 (16)"
          },
          "10": {
            "extreme": "2d12+20 (33)",
            "high": "2d12+13 (26)",
            "moderate": "2d10+11 (22)",
            "low": "2d6+10 (17)"
          },
          "11": {
            "extreme": "2d12+22 (35)",
            "high": "2d12+15 (28)",
            "moderate": "2d10+12 (23)",
            "low": "2d8+10 (19)"
          },
          "12": {
            "extreme": "3d12+19 (38)",
            "high": "3d10+14 (30)",
            "moderate": "3d8+12 (25)",
            "low": "3d6+10 (20)"
          },
          "13": {
            "extreme": "3d12+21 (40)",
            "high": "3d10+16 (32)",
            "moderate": "3d8+14 (27)",
            "low": "3d6+11 (21)"
          },
          "14": {
            "extreme": "3d12+24 (43)",
            "high": "3d10+18 (34)",
            "moderate": "3d8+15 (28)",
            "low": "3d6+13 (23)"
          },
          "15": {
            "extreme": "3d12+26 (45)",
            "high": "3d12+17 (36)",
            "moderate": "3d10+14 (30)",
            "low": "3d6+14 (24)"
          },
          "16": {
            "extreme": "3d12+29 (48)",
            "high": "3d12+18 (37)",
            "moderate": "3d10+15 (31)",
            "low": "3d6+15 (25)"
          },
          "17": {
            "extreme": "3d12+31 (50)",
            "high": "3d12+19 (38)",
            "moderate": "3d10+16 (32)",
            "low": "3d6+16 (26)"
          },
          "18": {
            "extreme": "3d12+34 (53)",
            "high": "3d12+20 (40)",
            "moderate": "3d10+17 (33)",
            "low": "3d6+17 (27)"
          },
          "19": {
            "extreme": "4d12+29 (55)",
            "high": "4d10+20 (42)",
            "moderate": "4d8+17 (35)",
            "low": "4d6+14 (28)"
          },
          "20": {
            "extreme": "4d12+32 (58)",
            "high": "4d10+22 (44)",
            "moderate": "4d8+19 (37)",
            "low": "4d6+15 (29)"
          },
          "21": {
            "extreme": "4d12+34 (60)",
            "high": "4d10+24 (46)",
            "moderate": "4d8+20 (38)",
            "low": "4d6+17 (31)"
          },
          "22": {
            "extreme": "4d12+37 (63)",
            "high": "4d10+26 (48)",
            "moderate": "4d8+22 (40)",
            "low": "4d6+18 (32)"
          },
          "23": {
            "extreme": "4d12+39 (65)",
            "high": "4d12+24 (50)",
            "moderate": "4d10+20 (42)",
            "low": "4d6+19 (33)"
          },
          "24": {
            "extreme": "4d12+42 (68)",
            "high": "4d12+26 (52)",
            "moderate": "4d10+22 (44)",
            "low": "4d6+21 (35)"
          },
          "-1": {
            "extreme": "1d6+1 (4)",
            "high": "1d4+1 (3)",
            "moderate": "1d4 (3)",
            "low": "1d4 (2)"
          }
        }
      }
    ]
  },
  "spellDC": {
    "source": {
      "id": "rules-2899",
      "name": "Spell DC and Spell Attack Modifier",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 122"
    },
    "tables": [
      {
        "caption": "Table 2-11: Spell DC and Spell Attack Bonus",
        "columns": [
          "Level",
          "Extreme DC",
          "Extreme Spell Attack Bonus",
          "High DC",
          "High Spell Attack Bonus",
          "Moderate DC",
          "Moderate Spell Attack Bonus"
        ],
        "rows": [
          [
            "-1",
            "19",
            "+11",
            "16",
            "+8",
            "13",
            "+5"
          ],
          [
            "0",
            "19",
            "+11",
            "16",
            "+8",
            "13",
            "+5"
          ],
          [
            "1",
            "20",
            "+12",
            "17",
            "+9",
            "14",
            "+6"
          ],
          [
            "2",
            "22",
            "+14",
            "18",
            "+10",
            "15",
            "+7"
          ],
          [
            "3",
            "23",
            "+15",
            "20",
            "+12",
            "17",
            "+9"
          ],
          [
            "4",
            "25",
            "+17",
            "21",
            "+13",
            "18",
            "+10"
          ],
          [
            "5",
            "26",
            "+18",
            "22",
            "+14",
            "19",
            "+11"
          ],
          [
            "6",
            "27",
            "+19",
            "24",
            "+16",
            "21",
            "+13"
          ],
          [
            "7",
            "29",
            "+21",
            "25",
            "+17",
            "22",
            "+14"
          ],
          [
            "8",
            "30",
            "+22",
            "26",
            "+18",
            "23",
            "+15"
          ],
          [
            "9",
            "32",
            "+24",
            "28",
            "+20",
            "25",
            "+17"
          ],
          [
            "10",
            "33",
            "+25",
            "29",
            "+21",
            "26",
            "+18"
          ],
          [
            "11",
            "34",
            "+26",
            "30",
            "+22",
            "27",
            "+19"
          ],
          [
            "12",
            "36",
            "+28",
            "32",
            "+24",
            "29",
            "+21"
          ],
          [
            "13",
            "37",
            "+29",
            "33",
            "+25",
            "30",
            "+22"
          ],
          [
            "14",
            "39",
            "+31",
            "34",
            "+26",
            "31",
            "+23"
          ],
          [
            "15",
            "40",
            "+32",
            "36",
            "+28",
            "33",
            "+25"
          ],
          [
            "16",
            "41",
            "+33",
            "37",
            "+29",
            "34",
            "+26"
          ],
          [
            "17",
            "43",
            "+35",
            "38",
            "+30",
            "35",
            "+27"
          ],
          [
            "18",
            "44",
            "+36",
            "40",
            "+32",
            "37",
            "+29"
          ],
          [
            "19",
            "46",
            "+38",
            "41",
            "+33",
            "38",
            "+30"
          ],
          [
            "20",
            "47",
            "+39",
            "42",
            "+34",
            "39",
            "+31"
          ],
          [
            "21",
            "48",
            "+40",
            "44",
            "+36",
            "41",
            "+33"
          ],
          [
            "22",
            "50",
            "+42",
            "45",
            "+37",
            "42",
            "+34"
          ],
          [
            "23",
            "51",
            "+43",
            "46",
            "+38",
            "43",
            "+35"
          ],
          [
            "24",
            "52",
            "+44",
            "48",
            "+40",
            "45",
            "+37"
          ]
        ],
        "byLevel": {
          "0": {
            "extreme dc": 19,
            "extreme spell attack bonus": 11,
            "high dc": 16,
            "high spell attack bonus": 8,
            "moderate dc": 13,
            "moderate spell attack bonus": 5
          },
          "1": {
            "extreme dc": 20,
            "extreme spell attack bonus": 12,
            "high dc": 17,
            "high spell attack bonus": 9,
            "moderate dc": 14,
            "moderate spell attack bonus": 6
          },
          "2": {
            "extreme dc": 22,
            "extreme spell attack bonus": 14,
            "high dc": 18,
            "high spell attack bonus": 10,
            "moderate dc": 15,
            "moderate spell attack bonus": 7
          },
          "3": {
            "extreme dc": 23,
            "extreme spell attack bonus": 15,
            "high dc": 20,
            "high spell attack bonus": 12,
            "moderate dc": 17,
            "moderate spell attack bonus": 9
          },
          "4": {
            "extreme dc": 25,
            "extreme spell attack bonus": 17,
            "high dc": 21,
            "high spell attack bonus": 13,
            "moderate dc": 18,
            "moderate spell attack bonus": 10
          },
          "5": {
            "extreme dc": 26,
            "extreme spell attack bonus": 18,
            "high dc": 22,
            "high spell attack bonus": 14,
            "moderate dc": 19,
            "moderate spell attack bonus": 11
          },
          "6": {
            "extreme dc": 27,
            "extreme spell attack bonus": 19,
            "high dc": 24,
            "high spell attack bonus": 16,
            "moderate dc": 21,
            "moderate spell attack bonus": 13
          },
          "7": {
            "extreme dc": 29,
            "extreme spell attack bonus": 21,
            "high dc": 25,
            "high spell attack bonus": 17,
            "moderate dc": 22,
            "moderate spell attack bonus": 14
          },
          "8": {
            "extreme dc": 30,
            "extreme spell attack bonus": 22,
            "high dc": 26,
            "high spell attack bonus": 18,
            "moderate dc": 23,
            "moderate spell attack bonus": 15
          },
          "9": {
            "extreme dc": 32,
            "extreme spell attack bonus": 24,
            "high dc": 28,
            "high spell attack bonus": 20,
            "moderate dc": 25,
            "moderate spell attack bonus": 17
          },
          "10": {
            "extreme dc": 33,
            "extreme spell attack bonus": 25,
            "high dc": 29,
            "high spell attack bonus": 21,
            "moderate dc": 26,
            "moderate spell attack bonus": 18
          },
          "11": {
            "extreme dc": 34,
            "extreme spell attack bonus": 26,
            "high dc": 30,
            "high spell attack bonus": 22,
            "moderate dc": 27,
            "moderate spell attack bonus": 19
          },
          "12": {
            "extreme dc": 36,
            "extreme spell attack bonus": 28,
            "high dc": 32,
            "high spell attack bonus": 24,
            "moderate dc": 29,
            "moderate spell attack bonus": 21
          },
          "13": {
            "extreme dc": 37,
            "extreme spell attack bonus": 29,
            "high dc": 33,
            "high spell attack bonus": 25,
            "moderate dc": 30,
            "moderate spell attack bonus": 22
          },
          "14": {
            "extreme dc": 39,
            "extreme spell attack bonus": 31,
            "high dc": 34,
            "high spell attack bonus": 26,
            "moderate dc": 31,
            "moderate spell attack bonus": 23
          },
          "15": {
            "extreme dc": 40,
            "extreme spell attack bonus": 32,
            "high dc": 36,
            "high spell attack bonus": 28,
            "moderate dc": 33,
            "moderate spell attack bonus": 25
          },
          "16": {
            "extreme dc": 41,
            "extreme spell attack bonus": 33,
            "high dc": 37,
            "high spell attack bonus": 29,
            "moderate dc": 34,
            "moderate spell attack bonus": 26
          },
          "17": {
            "extreme dc": 43,
            "extreme spell attack bonus": 35,
            "high dc": 38,
            "high spell attack bonus": 30,
            "moderate dc": 35,
            "moderate spell attack bonus": 27
          },
          "18": {
            "extreme dc": 44,
            "extreme spell attack bonus": 36,
            "high dc": 40,
            "high spell attack bonus": 32,
            "moderate dc": 37,
            "moderate spell attack bonus": 29
          },
          "19": {
            "extreme dc": 46,
            "extreme spell attack bonus": 38,
            "high dc": 41,
            "high spell attack bonus": 33,
            "moderate dc": 38,
            "moderate spell attack bonus": 30
          },
          "20": {
            "extreme dc": 47,
            "extreme spell attack bonus": 39,
            "high dc": 42,
            "high spell attack bonus": 34,
            "moderate dc": 39,
            "moderate spell attack bonus": 31
          },
          "21": {
            "extreme dc": 48,
            "extreme spell attack bonus": 40,
            "high dc": 44,
            "high spell attack bonus": 36,
            "moderate dc": 41,
            "moderate spell attack bonus": 33
          },
          "22": {
            "extreme dc": 50,
            "extreme spell attack bonus": 42,
            "high dc": 45,
            "high spell attack bonus": 37,
            "moderate dc": 42,
            "moderate spell attack bonus": 34
          },
          "23": {
            "extreme dc": 51,
            "extreme spell attack bonus": 43,
            "high dc": 46,
            "high spell attack bonus": 38,
            "moderate dc": 43,
            "moderate spell attack bonus": 35
          },
          "24": {
            "extreme dc": 52,
            "extreme spell attack bonus": 44,
            "high dc": 48,
            "high spell attack bonus": 40,
            "moderate dc": 45,
            "moderate spell attack bonus": 37
          },
          "-1": {
            "extreme dc": 19,
            "extreme spell attack bonus": 11,
            "high dc": 16,
            "high spell attack bonus": 8,
            "moderate dc": 13,
            "moderate spell attack bonus": 5
          }
        }
      }
    ]
  },
  "areaDamage": {
    "source": {
      "id": "rules-2910",
      "name": "Damage-Dealing Abilities",
      "page": "[GM Core](/Sources.aspx?ID=218) pg. 124"
    },
    "tables": [
      {
        "caption": "Table 2-12: Area Damage",
        "columns": [
          "Level",
          "Unlimited Use",
          "Limited Use"
        ],
        "rows": [
          [
            "-1",
            "1d4 (2)",
            "1d6 (4)"
          ],
          [
            "0",
            "1d6 (4)",
            "1d10 (6)"
          ],
          [
            "1",
            "2d4 (5)",
            "2d6 (7)"
          ],
          [
            "2",
            "2d6 (7)",
            "3d6 (11)"
          ],
          [
            "3",
            "2d8 (9)",
            "4d6 (14)"
          ],
          [
            "4",
            "3d6 (11)",
            "5d6 (18)"
          ],
          [
            "5",
            "2d10 (12)",
            "6d6 (21)"
          ],
          [
            "6",
            "4d6 (14)",
            "7d6 (25)"
          ],
          [
            "7",
            "4d6 (15)",
            "8d6 (28)"
          ],
          [
            "8",
            "5d6 (17)",
            "9d6 (32)"
          ],
          [
            "9",
            "5d6 (18)",
            "10d6 (35)"
          ],
          [
            "10",
            "6d6 (20)",
            "11d6 (39)"
          ],
          [
            "11",
            "6d6 (21)",
            "12d6 (42)"
          ],
          [
            "12",
            "5d8 (23)",
            "13d6 (46)"
          ],
          [
            "13",
            "7d6 (24)",
            "14d6 (49)"
          ],
          [
            "14",
            "4d12 (26)",
            "15d6 (53)"
          ],
          [
            "15",
            "6d8 (27)",
            "16d6 (56)"
          ],
          [
            "16",
            "8d6 (28)",
            "17d6 (60)"
          ],
          [
            "17",
            "8d6 (29)",
            "18d6 (63)"
          ],
          [
            "18",
            "9d6 (30)",
            "19d6 (67)"
          ],
          [
            "19",
            "7d8 (32)",
            "20d6 (70)"
          ],
          [
            "20",
            "6d10 (33)",
            "21d6 (74)"
          ],
          [
            "21",
            "10d6 (35)",
            "22d6 (77)"
          ],
          [
            "22",
            "8d8 (36)",
            "23d6 (81)"
          ],
          [
            "23",
            "11d6 (38)",
            "24d6 (84)"
          ],
          [
            "24",
            "11d6 (39)",
            "25d6 (88)"
          ]
        ],
        "byLevel": {
          "0": {
            "unlimited use": "1d6 (4)",
            "limited use": "1d10 (6)"
          },
          "1": {
            "unlimited use": "2d4 (5)",
            "limited use": "2d6 (7)"
          },
          "2": {
            "unlimited use": "2d6 (7)",
            "limited use": "3d6 (11)"
          },
          "3": {
            "unlimited use": "2d8 (9)",
            "limited use": "4d6 (14)"
          },
          "4": {
            "unlimited use": "3d6 (11)",
            "limited use": "5d6 (18)"
          },
          "5": {
            "unlimited use": "2d10 (12)",
            "limited use": "6d6 (21)"
          },
          "6": {
            "unlimited use": "4d6 (14)",
            "limited use": "7d6 (25)"
          },
          "7": {
            "unlimited use": "4d6 (15)",
            "limited use": "8d6 (28)"
          },
          "8": {
            "unlimited use": "5d6 (17)",
            "limited use": "9d6 (32)"
          },
          "9": {
            "unlimited use": "5d6 (18)",
            "limited use": "10d6 (35)"
          },
          "10": {
            "unlimited use": "6d6 (20)",
            "limited use": "11d6 (39)"
          },
          "11": {
            "unlimited use": "6d6 (21)",
            "limited use": "12d6 (42)"
          },
          "12": {
            "unlimited use": "5d8 (23)",
            "limited use": "13d6 (46)"
          },
          "13": {
            "unlimited use": "7d6 (24)",
            "limited use": "14d6 (49)"
          },
          "14": {
            "unlimited use": "4d12 (26)",
            "limited use": "15d6 (53)"
          },
          "15": {
            "unlimited use": "6d8 (27)",
            "limited use": "16d6 (56)"
          },
          "16": {
            "unlimited use": "8d6 (28)",
            "limited use": "17d6 (60)"
          },
          "17": {
            "unlimited use": "8d6 (29)",
            "limited use": "18d6 (63)"
          },
          "18": {
            "unlimited use": "9d6 (30)",
            "limited use": "19d6 (67)"
          },
          "19": {
            "unlimited use": "7d8 (32)",
            "limited use": "20d6 (70)"
          },
          "20": {
            "unlimited use": "6d10 (33)",
            "limited use": "21d6 (74)"
          },
          "21": {
            "unlimited use": "10d6 (35)",
            "limited use": "22d6 (77)"
          },
          "22": {
            "unlimited use": "8d8 (36)",
            "limited use": "23d6 (81)"
          },
          "23": {
            "unlimited use": "11d6 (38)",
            "limited use": "24d6 (84)"
          },
          "24": {
            "unlimited use": "11d6 (39)",
            "limited use": "25d6 (88)"
          },
          "-1": {
            "unlimited use": "1d4 (2)",
            "limited use": "1d6 (4)"
          }
        }
      }
    ]
  }
} as const satisfies Record<string, CreatureTableGroup>;

export type CreatureTableKey = keyof typeof CREATURE_TABLES;
