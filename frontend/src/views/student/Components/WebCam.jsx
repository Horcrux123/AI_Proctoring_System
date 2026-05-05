import React, { useRef, useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import Webcam from 'react-webcam';
import { drawRect } from './utilities';
import { Box, Card } from '@mui/material';
import swal from 'sweetalert';
import { UploadClient } from '@uploadcare/upload-client';
import { useSelector } from 'react-redux';
import { useCheatingLog } from 'src/context/CheatingLogContext';

const client = new UploadClient({ publicKey: 'e69ab6e5db6d4a41760b' });

export default function Home({ onViolation, enableVoiceProctoring = false, questions = [] }) {
  const {
    cheatingLog,
    updateCheatingLog,
    isAIReady: globalAIReady,
    cocoNet: globalCocoNet,
    faceapiReady: globalFaceapiReady
  } = useCheatingLog();

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const { userInfo } = useSelector((state) => state.auth);
  const [lastDetectionTime, setLastDetectionTime] = useState({});
  const [screenshots, setScreenshots] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [isFaceMatcherReady, setIsFaceMatcherReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const detectIntervalRef = useRef(null);

  // Use refs to escape stale closures within setInterval
  const isReadyRef = useRef(false);
  const isDetectingRef = useRef(false);
  const lastDetectionTimeRef = useRef({});
  const cheatingLogRef = useRef(cheatingLog);
  const faceMatcherRef = useRef(faceMatcher);
  const onViolationRef = useRef(onViolation);

  // Sync latest props/state to refs continuously
  useEffect(() => { cheatingLogRef.current = cheatingLog; }, [cheatingLog]);
  useEffect(() => { faceMatcherRef.current = faceMatcher; }, [faceMatcher]);
  useEffect(() => { onViolationRef.current = onViolation; }, [onViolation]);

  // Audio proctoring state
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const animationFrameRef = useRef(null);

  const startProctoringLoop = (net) => {
    setIsReady(true);
    isReadyRef.current = true;
    console.log('🛡️ AI proctoring active');

    if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    detectIntervalRef.current = setInterval(() => {
      if (webcamRef.current) {
        detect(net);
      }
    }, 1000); // 1-second interval loops just like the original X codebase
  };

  // Initialize identity matcher using global face-api
  useEffect(() => {
    if (globalFaceapiReady && userInfo?.profileImage && !faceMatcher) {
      const initializeMatcher = async () => {
        try {
          console.log('Initializing Identity Matcher...');
          const referenceImg = await new Promise((resolve, reject) => {
            const img = new Image();
            // Do NOT set crossOrigin for base64 data: URLs — it breaks loading
            if (!userInfo.profileImage.startsWith('data:')) {
              img.crossOrigin = 'anonymous';
            }
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Profile image load failed'));
            img.src = userInfo.profileImage;
          });

          const detection = await faceapi
            .detectSingleFace(referenceImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            // CRITICAL: must use LabeledFaceDescriptors, not raw detection
            const labeled = new faceapi.LabeledFaceDescriptors(
              'registered_user',
              [detection.descriptor]
            );
            // 0.55 is a balanced threshold. Lower (0.45) is too strict and causes false positives on lighting changes.
            setFaceMatcher(new faceapi.FaceMatcher([labeled], 0.55));
            setIsFaceMatcherReady(true);
            console.log('Identity Matcher Ready');
          } else {
            console.warn('No face found in profile image — identity matching disabled');
          }
        } catch (err) {
          console.error('Matcher init error:', err);
        }
      };
      initializeMatcher();
    }
  }, [globalFaceapiReady, userInfo?.profileImage, faceMatcher]);

  // Start proctoring loop when global AI is ready
  useEffect(() => {
    if (globalAIReady && globalCocoNet) {
      startProctoringLoop(globalCocoNet);
    }
    return () => {
      if (detectIntervalRef.current) clearInterval(detectIntervalRef.current);
    };
  }, [globalAIReady, globalCocoNet]);

  const captureScreenshotAndUpload = async (type) => {
    const video = webcamRef.current?.video;

    if (
      !video ||
      video.readyState !== 4 || // ensure video is ready
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.warn('Video not ready for screenshot');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Compress the image to keep base64 size extremely small (~30kb) and save directly into MongoDB without failure
    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

    const screenshot = {
      url: dataUrl,
      type: type,
      detectedAt: new Date()
    };

    // Update local screenshots state
    setScreenshots(prev => [...prev, screenshot]);
    console.log('✅ Screenshot captured and saved directly as Base64');

    return screenshot;
  };

  const captureBase64 = () => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.6);
  };

  const handleDetection = async (type) => {
    const now = Date.now();
    const lastTime = lastDetectionTimeRef.current[type] || 0;

    // Balanced Cooldown: 5 seconds.
    // This gives students time to correct their behavior without instant disqualification.
    const waitTime = type === 'identityMismatch' ? 10000 : 5000;

    if (now - lastTime >= waitTime) {
      lastDetectionTimeRef.current[type] = now;
      setLastDetectionTime({ ...lastDetectionTimeRef.current });

      updateCheatingLog((prev) => {
        const screenshot = {
          url: webcamRef.current?.video ? captureBase64() : null,
          type: type,
          detectedAt: new Date()
        };

        const newCount = (prev[`${type}Count`] || 0) + 1;
        const newLog = {
          ...prev,
          [`${type}Count`]: newCount,
          screenshots: screenshot.url ? [...(prev.screenshots || []), screenshot] : (prev.screenshots || [])
        };

        console.log(`🛡️ Proctoring Violation [${type}]: ${newCount}/15`);
        
        // Pass the updated log directly to parent for immediate feedback
        if (onViolationRef.current) {
          onViolationRef.current(type, newLog);
        }

        return newLog;
      });
    }
  };

  // Start Voice Proctoring (Smart Transcript Version)
  useEffect(() => {
    if (globalAIReady && isReady && enableVoiceProctoring) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.warn("Speech Recognition API not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false; // Wait for them to finish the sentence
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.toLowerCase();

        if (transcript.trim().length > 0) {
          console.log("🎤 Speech detected:", transcript);

          // 1. Check for explicit cheating phrases
          const suspiciousPhrases = [
            "answer", "what is", "tell me", "help me", "which option",
            "option a", "option b", "option c", "option d", "solve", "search"
          ];
          const hasSuspiciousPhrase = suspiciousPhrases.some(phrase => transcript.includes(phrase));

          // 2. Check if the person is just reading the question text
          let isReadingQuestion = false;
          let spokenWords = [];

          if (questions && questions.length > 0) {
            // Combine all question text and option text into one giant string for comparison
            const allExamText = questions.map(q => {
              let text = q.question || "";
              if (q.description) {
                text += " " + q.description;
              }
              if (q.options) {
                text += " " + q.options.map(o => o.optionText).join(" ");
              }
              return text.toLowerCase();
            }).join(" ");

            // Extract meaningful words from their speech (longer than 2 letters)
            spokenWords = transcript.split(/\s+/).filter(w => w.length > 2);

            let matchedWords = 0;
            spokenWords.forEach(word => {
              if (allExamText.includes(word)) {
                matchedWords++;
              }
            });

            // If 25% or more of their meaningful words match the text on screen, 
            // we assume they are just reading the question aloud to themselves.
            if (spokenWords.length > 0 && (matchedWords / spokenWords.length) >= 0.25) {
              isReadingQuestion = true;
            }
          }

          // 3. Final Decision Logic
          // Only trigger if word count is > 3 and not read-back
          if (hasSuspiciousPhrase) {
            console.warn("🚨 Violation Triggered: Suspicious phrase detected.");
            handleDetection('voiceDetected');
          } else if (spokenWords.length > 3 && !isReadingQuestion) {
            // More than 3 significant words that aren't on the exam paper
            console.warn("🚨 Violation Triggered: Continuous speech not matching exam context.");
            handleDetection('voiceDetected');
          } else {
            console.log("✅ Ignored: Short utterance or exam-related reading.");
          }
        }
      };

      recognition.onerror = (event) => {
        // Ignore "no speech" errors as they are normal during silent exams
        if (event.error !== 'no-speech') {
          console.error("Speech recognition error", event.error);
        }
      };

      // Automatically restart listening if the browser tries to stop it
      recognition.onend = () => {
        if (isReady && enableVoiceProctoring) {
          try { recognition.start(); } catch (e) { }
        }
      };

      try {
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }

      return () => {
        recognition.onend = null;
        recognition.stop();
      };
    }
  }, [globalAIReady, isReady, enableVoiceProctoring, questions]);

  const detect = async (net) => {
    if (isDetectingRef.current || !isReadyRef.current) return;

    const video = webcamRef.current?.video;
    if (video && video.readyState === 4) {
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      if (videoWidth === 0 || videoHeight === 0 || !canvasRef.current) return;

      isDetectingRef.current = true;
      setIsDetecting(true);

      try {
        // Force exact hardware sizes to the DOM element so TF.js scales boxes perfectly
        video.width = videoWidth;
        video.height = videoHeight;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        // 1. Run COCO-SSD (Object Detection)
        const obj = await net.detect(video);

        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        drawRect(obj, ctx);

        let person_count = 0;
        let faceDetected = false;
        let cellPhoneDetected = false;
        let prohibitedObjectDetected = false;

        obj.forEach((element) => {
          const detectedClass = element.class;
          if (detectedClass === 'cell phone') cellPhoneDetected = true;
          if (detectedClass === 'book' || detectedClass === 'laptop')
            prohibitedObjectDetected = true;
          if (detectedClass === 'person') {
            faceDetected = true;
            person_count++;
          }
        });

        if (cellPhoneDetected) handleDetection('cellPhone');
        if (prohibitedObjectDetected) handleDetection('prohibitedObject');

        if (!faceDetected) {
          handleDetection('noFace');
        } else if (person_count > 1) {
          handleDetection('multipleFace');
        }

        // 2. Short pause to let WebGL breathe
        await new Promise(r => setTimeout(r, 300));

        // 3. Run Face-API (Identity Match)
        // ONLY if exactly one person is present and matcher is ready
        if (globalFaceapiReady && faceMatcherRef.current && person_count === 1 && webcamRef.current?.video) {
          const currentVideo = webcamRef.current.video;
          if (currentVideo.readyState === 4) {
            const detection = await faceapi
              .detectSingleFace(currentVideo, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (detection) {
              const match = faceMatcherRef.current.findBestMatch(detection.descriptor);
              // Label will be 'registered_user' if match succeeded, 'unknown' if not
              if (match.label === 'unknown') {
                // TEMPORARILY DISABLED: The FaceAPI matching algorithm is causing
                // frequent false-positives for the registered user based on lighting/angles.
                console.warn('Identity mismatch detected, but auto-submit is disabled.');
                // handleDetection('identityMismatch');
              } else {
                // If it's the registered user, check for eye gaze / head pose using 68 point landmarks
                const landmarks = detection.landmarks.positions;
                if (landmarks && landmarks.length >= 68) {
                  const leftEdge = landmarks[0];
                  const rightEdge = landmarks[16];
                  const nose = landmarks[30]; // Nose bridge/tip

                  if (leftEdge && rightEdge && nose) {
                    const leftDist = nose.x - leftEdge.x;
                    const rightDist = rightEdge.x - nose.x;

                    // Prevent division by zero and logical anomalies
                    if (rightDist > 0 && leftDist > 0) {
                      const ratio = leftDist / rightDist;

                      // Significant deviation indicates face turned sharply left or right
                      // Increased deviation threshold indicates face turned sharply left or right
                      // Used 3.0 and 0.33 for standard threshold (less sensitive than default 4.0/0.25 which was over-sensitive)
                      if (ratio > 3.0 || ratio < 0.33) {
                        handleDetection('eyeGaze');
                      }
                    }
                  }
                }
              }
            } else {
              // COCO-SSD detected a person's body, but Face-API couldn't find a frontal face!
              // This happens when the student turns their head completely away or covers their face.
              handleDetection('eyeGaze');
            }
          }
        }
      } catch (error) {
        console.error('Proctoring scan error:', error);
      } finally {
        isDetectingRef.current = false;
        setIsDetecting(false);
      }
    }
  };


  return (
    <Box>
      <Card variant="outlined" sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', top: 5, left: 5, zIndex: 20, color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
          AI Proctor: {globalAIReady ? '🟢 Active' : '⏳ Loading Models...'}
        </div>
        <Webcam
          ref={webcamRef}
          audio={enableVoiceProctoring}
          muted
          screenshotFormat="image/jpeg"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: 'user',
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 10,
          }}
        />
      </Card>
    </Box>
  );
}

// Helper to convert base64 to File
function dataURLtoFile(dataUrl, fileName) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mime });
}
