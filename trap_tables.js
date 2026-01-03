(function(global){
  const tables = {
  "I": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 25.0,
      "h10": 2.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": -5.0,
      "h10": 3.0
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -35.0,
      "h10": 1.5
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 45.0,
      "h10": 2.5
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": 10.0,
      "h10": 1.8
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -35.0,
      "h10": 3.0
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 35.0,
      "h10": 3.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": -5.0,
      "h10": 1.5
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -45.0,
      "h10": 1.6
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 40.0,
      "h10": 1.5
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -25.0,
      "h10": 2.6
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 20.0,
      "h10": 2.4
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 5.0,
      "h10": 1.9
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -35.0,
      "h10": 3.0
    }
  ],
  "II": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 25.0,
      "h10": 3.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": -5.0,
      "h10": 1.8
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -35.0,
      "h10": 2.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 40.0,
      "h10": 2.0
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -45.0,
      "h10": 1.6
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 45.0,
      "h10": 1.5
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": 0.0,
      "h10": 2.8
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -40.0,
      "h10": 2.0
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 15.0,
      "h10": 1.5
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 5.0,
      "h10": 2.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -35.0,
      "h10": 1.8
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 35.0,
      "h10": 1.8
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": -5.0,
      "h10": 1.5
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -40.0,
      "h10": 3.0
    }
  ],
  "III": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 30.0,
      "h10": 2.5
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 0.0,
      "h10": 2.8
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -35.0,
      "h10": 3.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 45.0,
      "h10": 1.5
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": -5.0,
      "h10": 2.5
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -40.0,
      "h10": 1.7
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 30.0,
      "h10": 2.8
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": 5.0,
      "h10": 3.0
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -45.0,
      "h10": 1.5
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 45.0,
      "h10": 2.3
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -40.0,
      "h10": 1.6
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 30.0,
      "h10": 2.0
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 0.0,
      "h10": 1.5
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -35.0,
      "h10": 2.2
    }
  ],
  "IV": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 40.0,
      "h10": 3.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 10.0,
      "h10": 1.5
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -30.0,
      "h10": 2.2
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 30.0,
      "h10": 1.6
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": -10.0,
      "h10": 3.0
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -35.0,
      "h10": 2.0
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 45.0,
      "h10": 2.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -20.0,
      "h10": 1.5
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 30.0,
      "h10": 1.5
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": -5.0,
      "h10": 2.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -45.0,
      "h10": 2.8
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 35.0,
      "h10": 2.5
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 0.0,
      "h10": 1.6
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -30.0,
      "h10": 3.0
    }
  ],
  "V": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 45.0,
      "h10": 1.6
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -15.0,
      "h10": 2.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 40.0,
      "h10": 2.8
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": -10.0,
      "h10": 1.5
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -45.0,
      "h10": 2.0
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 35.0,
      "h10": 3.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": -5.0,
      "h10": 1.8
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -40.0,
      "h10": 1.5
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 25.0,
      "h10": 1.8
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 0.0,
      "h10": 1.6
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -30.0,
      "h10": 3.0
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 30.0,
      "h10": 2.0
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 10.0,
      "h10": 2.4
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -15.0,
      "h10": 1.8
    }
  ],
  "VI": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 40.0,
      "h10": 2.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -35.0,
      "h10": 1.5
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 35.0,
      "h10": 2.5
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": 10.0,
      "h10": 1.5
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -35.0,
      "h10": 2.0
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 35.0,
      "h10": 2.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": -5.0,
      "h10": 1.5
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -40.0,
      "h10": 3.0
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 45.0,
      "h10": 1.5
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": -10.0,
      "h10": 3.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -25.0,
      "h10": 2.6
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 25.0,
      "h10": 2.4
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 5.0,
      "h10": 1.5
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -45.0,
      "h10": 2.0
    }
  ],
  "VII": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 35.0,
      "h10": 2.2
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": -5.0,
      "h10": 3.0
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -20.0,
      "h10": 3.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 40.0,
      "h10": 2.0
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -45.0,
      "h10": 2.8
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 40.0,
      "h10": 3.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": 0.0,
      "h10": 2.0
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -40.0,
      "h10": 2.2
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 45.0,
      "h10": 1.5
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 5.0,
      "h10": 2.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -35.0,
      "h10": 1.8
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 20.0,
      "h10": 1.8
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": -5.0,
      "h10": 1.5
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -45.0,
      "h10": 2.0
    }
  ],
  "VIII": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 25.0,
      "h10": 3.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 5.0,
      "h10": 1.5
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -20.0,
      "h10": 2.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 40.0,
      "h10": 1.5
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": 0.0,
      "h10": 3.0
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -45.0,
      "h10": 2.8
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 35.0,
      "h10": 3.0
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": -5.0,
      "h10": 2.5
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -45.0,
      "h10": 2.0
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 45.0,
      "h10": 1.8
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": 0.0,
      "h10": 1.5
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -30.0,
      "h10": 3.0
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 30.0,
      "h10": 2.0
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 10.0,
      "h10": 3.0
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -15.0,
      "h10": 2.2
    }
  ],
  "IX": [
    {
      "machine": 1,
      "group": 1,
      "azDeg": 40.0,
      "h10": 3.0
    },
    {
      "machine": 2,
      "group": 1,
      "azDeg": 0.0,
      "h10": 1.8
    },
    {
      "machine": 3,
      "group": 1,
      "azDeg": -20.0,
      "h10": 3.0
    },
    {
      "machine": 4,
      "group": 2,
      "azDeg": 15.0,
      "h10": 3.0
    },
    {
      "machine": 5,
      "group": 2,
      "azDeg": -10.0,
      "h10": 1.5
    },
    {
      "machine": 6,
      "group": 2,
      "azDeg": -35.0,
      "h10": 2.0
    },
    {
      "machine": 7,
      "group": 3,
      "azDeg": 45.0,
      "h10": 1.6
    },
    {
      "machine": 8,
      "group": 3,
      "azDeg": 0.0,
      "h10": 2.8
    },
    {
      "machine": 9,
      "group": 3,
      "azDeg": -30.0,
      "h10": 3.0
    },
    {
      "machine": 10,
      "group": 4,
      "azDeg": 30.0,
      "h10": 2.0
    },
    {
      "machine": 11,
      "group": 4,
      "azDeg": -5.0,
      "h10": 2.0
    },
    {
      "machine": 12,
      "group": 4,
      "azDeg": -15.0,
      "h10": 3.0
    },
    {
      "machine": 13,
      "group": 5,
      "azDeg": 35.0,
      "h10": 2.9
    },
    {
      "machine": 14,
      "group": 5,
      "azDeg": 0.0,
      "h10": 1.6
    },
    {
      "machine": 15,
      "group": 5,
      "azDeg": -45.0,
      "h10": 2.2
    }
  ]
};
  function get(key){ return tables[key] || tables.I; }
  global.TrapTables = {tables, keys:Object.keys(tables), get};
})(window);
