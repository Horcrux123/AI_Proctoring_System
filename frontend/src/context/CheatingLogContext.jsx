import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as tf from '@tensorflow/tfjs';
import * as cocossd from '@tensorflow-models/coco-ssd';
import * as faceapi from '@vladmandic/face-api';

const CheatingLogContext = createContext();

export const CheatingLogProvider = ({ children }) => {
  const { userInfo } = useSelector((state) => state.auth);

  // AI State
  const [isAIInitializing, setIsAIInitializing] = useState(false);
  const [isAIReady, setIsAIReady] = useState(false);
  const [cocoNet, setCocoNet] = useState(null);
  const [faceapiReady, setFaceapiReady] = useState(false);

  const [cheatingLog, setCheatingLog] = useState({
    noFaceCount: 0,
    multipleFaceCount: 0,
    cellPhoneCount: 0,
    prohibitedObjectCount: 0,
    identityMismatchCount: 0,
    tabSwitchedCount: 0,
    exitedFullscreenCount: 0,
    voiceDetectedCount: 0,
    eyeGazeCount: 0,
    examId: '',
    username: userInfo?.name || '',
    email: userInfo?.email || '',
    screenshots: [],
  });

  // Initialize AI globally — ONCE, in the correct order
  useEffect(() => {
    if (isAIInitializing || isAIReady) return;

    const loadAI = async () => {
      setIsAIInitializing(true);
      try {
        // Initialize the main TF engine on WebGL to be shared across all models
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('TF backend:', tf.getBackend());

        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        console.log('Loading Face-API models...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

        console.log('Face-API models ready');
        setFaceapiReady(true);

        console.log('Loading COCO-SSD...');
        const net = await cocossd.load();
        setCocoNet(net);
        console.log('COCO-SSD ready');

        setIsAIReady(true);

      } catch (err) {
        console.error('AI init failed:', err);
      } finally {
        setIsAIInitializing(false);
      }
    };

    loadAI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userInfo) {
      setCheatingLog((prev) => ({
        ...prev,
        username: userInfo.name,
        email: userInfo.email,
      }));
    }
  }, [userInfo]);

  const updateCheatingLog = (update) => {
    setCheatingLog((prev) => {
      const newLog = typeof update === 'function' ? update(prev) : update;

      const updatedLog = {
        ...prev,
        ...newLog,
        noFaceCount: Number(newLog.noFaceCount ?? prev.noFaceCount ?? 0),
        multipleFaceCount: Number(newLog.multipleFaceCount ?? prev.multipleFaceCount ?? 0),
        cellPhoneCount: Number(newLog.cellPhoneCount ?? prev.cellPhoneCount ?? 0),
        prohibitedObjectCount: Number(newLog.prohibitedObjectCount ?? prev.prohibitedObjectCount ?? 0),
        identityMismatchCount: Number(newLog.identityMismatchCount ?? prev.identityMismatchCount ?? 0),
        tabSwitchedCount: Number(newLog.tabSwitchedCount ?? prev.tabSwitchedCount ?? 0),
        exitedFullscreenCount: Number(newLog.exitedFullscreenCount ?? prev.exitedFullscreenCount ?? 0),
        voiceDetectedCount: Number(newLog.voiceDetectedCount ?? prev.voiceDetectedCount ?? 0),
        eyeGazeCount: Number(newLog.eyeGazeCount ?? prev.eyeGazeCount ?? 0),
      };
      return updatedLog;
    });
  };

  const resetCheatingLog = (examId) => {
    const resetLog = {
      noFaceCount: 0,
      multipleFaceCount: 0,
      cellPhoneCount: 0,
      prohibitedObjectCount: 0,
      identityMismatchCount: 0,
      tabSwitchedCount: 0,
      exitedFullscreenCount: 0,
      voiceDetectedCount: 0,
      eyeGazeCount: 0,
      examId: examId,
      username: userInfo?.name || '',
      email: userInfo?.email || '',
      screenshots: [],
    };
    setCheatingLog(resetLog);
  };

  return (
    <CheatingLogContext.Provider value={{
      cheatingLog,
      updateCheatingLog,
      resetCheatingLog,
      isAIReady,
      cocoNet,
      faceapiReady
    }}>
      {children}
    </CheatingLogContext.Provider>
  );
};

export const useCheatingLog = () => {
  const context = useContext(CheatingLogContext);
  if (!context) {
    throw new Error('useCheatingLog must be used within a CheatingLogProvider');
  }
  return context;
};
