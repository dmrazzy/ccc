import {
  checkDecoder,
  checkPatternDob0,
  checkPatternDob1,
  DNA,
  Dob0,
  Dob1,
} from "../helper/index.js";

export function encodeDna(dna: DNA): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(JSON.stringify(dna));
}

export function encodeClusterDescriptionForDob0(dob0: Dob0): string {
  checkDecoder(dob0.dob.decoder);
  dob0.dob.pattern.forEach((v) => {
    checkPatternDob0(v);
    v.toJSON = function () {
      if (v.traitArgs) {
        return [
          v.traitName,
          v.dobType,
          v.dnaOffset,
          v.dnaLength,
          v.patternType,
          v.traitArgs,
        ];
      } else {
        return [
          v.traitName,
          v.dobType,
          v.dnaOffset,
          v.dnaLength,
          v.patternType,
        ];
      }
    };
  });
  return JSON.stringify(dob0);
}

export function encodeClusterDescriptionForDob1(dob1: Dob1): string {
  dob1.dob.decoders.forEach((value) => {
    checkDecoder(value.decoder);
    value.pattern.forEach((v) => {
      if ("dnaOffset" in v) {
        checkPatternDob0(v);
        v.toJSON = function () {
          if (v.traitArgs) {
            return [
              v.traitName,
              v.dobType,
              v.dnaOffset,
              v.dnaLength,
              v.patternType,
              v.traitArgs,
            ];
          } else {
            return [
              v.traitName,
              v.dobType,
              v.dnaOffset,
              v.dnaLength,
              v.patternType,
            ];
          }
        };
      } else {
        checkPatternDob1(v);
        v.toJSON = function () {
          return [
            v.imageName,
            v.svgFields,
            v.traitName,
            v.patternType,
            v.traitArgs,
          ];
        };
      }
    });
  });
  return JSON.stringify(dob1);
}
