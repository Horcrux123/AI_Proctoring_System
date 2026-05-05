import React, { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from '@vladmandic/face-api';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { toast } from 'react-toastify';
import { useCheatingLog } from 'src/context/CheatingLogContext';

const IdentityVerification = ({ onVerify, profileImage }) => {
    const { 
        faceapiReady: globalFaceapiReady,
        cocoNet: globalCocoNet,
        isAIReady: globalAIReady 
    } = useCheatingLog();
    const webcamRef = useRef(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);

    const handleVerify = async () => {
        if (!webcamRef.current || !globalAIReady || isVerifying) {
            if (!globalAIReady) toast.warn('AI models are still loading. Please wait...');
            return;
        }

        setIsVerifying(true);
        setVerificationError(null);
        setDebugInfo(null);

        try {
            // --- Step 1: Check camera feed ---
            const video = webcamRef.current.video;
            if (!video || video.readyState !== 4 || video.videoWidth === 0) {
                toast.warn('Camera not ready. Please wait a moment and try again.');
                setIsVerifying(false);
                return;
            }

            // --- Step 2: Use COCO-SSD to count people (Much more robust than face-api for counting) ---
            console.log('Checking for multiple people using COCO-SSD...');
            const objects = await globalCocoNet.detect(video);
            const persons = objects.filter(obj => obj.class === 'person');

            if (persons.length === 0) {
                setVerificationError('No person detected. Please ensure you are visible in the frame.');
                setIsVerifying(false);
                return;
            }

            if (persons.length > 1) {
                setVerificationError(`Multiple people detected (${persons.length}). Identity verification failed. Please ensure only you are in the frame.`);
                setIsVerifying(false);
                return;
            }

            // --- Step 3: Detect face in live webcam for identity matching ---
            console.log('Detecting face in webcam for identity check...');
            const liveDetections = await faceapi
                .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                .withFaceLandmarks()
                .withFaceDescriptors();

            if (!liveDetections || liveDetections.length === 0) {
                setVerificationError('Could not detect your face from the camera. Please look directly at the center and ensure your face is well-lit.');
                setIsVerifying(false);
                return;
            }

            // Double check face count as well
            if (liveDetections.length > 1) {
                setVerificationError('Multiple faces detected. Please ensure only you are in the frame.');
                setIsVerifying(false);
                return;
            }
            const liveDetection = liveDetections[0];

            console.log('Live face detected successfully');

            // --- Step 3: Check profile image exists ---
            if (!profileImage) {
                setVerificationError('No registered face photo found. Please re-register with a face photo.');
                setIsVerifying(false);
                return;
            }

            // --- Step 4: Load the registered profile image ---
            console.log('Loading profile image for comparison...');
            let referenceImg;
            try {
                referenceImg = await new Promise((resolve, reject) => {
                    const img = new Image();
                    // Only set crossOrigin for external URLs, NOT for base64/data URLs
                    if (!profileImage.startsWith('data:')) {
                        img.crossOrigin = 'anonymous';
                    }
                    img.onload = () => resolve(img);
                    img.onerror = (e) => {
                        console.error('Profile image load error:', e);
                        reject(new Error('Failed to load profile photo'));
                    };
                    img.src = profileImage;
                });
            } catch (imgErr) {
                console.error('Profile image error:', imgErr);
                setVerificationError('Could not load your registered profile photo. Please update your profile.');
                setIsVerifying(false);
                return;
            }

            // --- Step 5: Detect face in the registered profile photo ---
            console.log('Detecting face in profile image...');
            const referenceDetection = await faceapi
                .detectSingleFace(referenceImg, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!referenceDetection) {
                setVerificationError('No face was found in your registered profile photo. Please re-register with a clearer face photo.');
                setIsVerifying(false);
                return;
            }
            console.log('Reference face detected successfully');

            // --- Step 6: Compare the two faces ---
            // Use LabeledFaceDescriptors correctly for FaceMatcher
            const labeledDescriptor = new faceapi.LabeledFaceDescriptors(
                'registered_user',
                [referenceDetection.descriptor]
            );
            const faceMatcher = new faceapi.FaceMatcher([labeledDescriptor], 0.45); // Threshold 0.45 — highly restrictive logic for strict identity
            const bestMatch = faceMatcher.findBestMatch(liveDetection.descriptor);

            console.log('Match result:', bestMatch.label, 'distance:', bestMatch.distance.toFixed(3));
            setDebugInfo(`Match distance: ${bestMatch.distance.toFixed(3)} (strict threshold: 0.45)`);

            if (bestMatch.label === 'registered_user') {
                toast.success(`Identity Verified! (Confidence: ${((1 - bestMatch.distance) * 100).toFixed(1)}%)`);
                onVerify(true);
            } else {
                const confidence = ((1 - bestMatch.distance) * 100).toFixed(1);
                setVerificationError(`Identity verification failed (similarity: ${confidence}%). Please ensure good lighting and look straight at the camera.`);
                onVerify(false);
            }

        } catch (err) {
            console.error('Verification error:', err);
            setVerificationError('An unexpected error occurred during verification. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, gap: 2 }}>
            <Typography variant="h4" fontWeight="bold">Identity Verification</Typography>
            <Typography variant="body1" textAlign="center">
                Before starting the exam, we need to verify your identity. <br />
                Please look directly at the camera and click <strong>"Verify Identity"</strong>.
            </Typography>

            {!globalAIReady ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography>Loading AI Models (approx. 15MB)...</Typography>
                </Box>
            ) : (
                <>
                    <Box sx={{
                        position: 'relative',
                        width: 400,
                        height: 300,
                        border: '2px solid #1976d2',
                        borderRadius: 2,
                        overflow: 'hidden'
                    }}>
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ width: 400, height: 300, facingMode: 'user' }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </Box>

                    {verificationError && (
                        <Alert severity="error" sx={{ width: '100%', maxWidth: 400 }}>
                            {verificationError}
                        </Alert>
                    )}

                    {debugInfo && (
                        <Typography variant="caption" color="text.secondary">
                            {debugInfo}
                        </Typography>
                    )}

                    <Button
                        variant="contained"
                        size="large"
                        disabled={isVerifying}
                        onClick={handleVerify}
                        sx={{ mt: 1, minWidth: 200 }}
                    >
                        {isVerifying ? <CircularProgress size={24} color="inherit" /> : 'Verify Identity'}
                    </Button>
                </>
            )}
        </Box>
    );
};

export default IdentityVerification;
