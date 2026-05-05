import React, { useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Select, MenuItem, IconButton, Stack, CircularProgress, Alert } from '@mui/material';
import Webcam from 'react-webcam';
import { CameraAlt, Replay, CheckCircle } from '@mui/icons-material';
import * as faceapi from '@vladmandic/face-api';

import CustomTextField from '../../../components/forms/theme-elements/CustomTextField';
import { useCheatingLog } from 'src/context/CheatingLogContext';

const videoConstraints = {
  width: 400,
  height: 400,
  facingMode: 'user',
};

const AuthRegister = ({ formik, title, subtitle, subtext, onFaceCapture }) => {
  const { faceapiReady: globalFaceapiReady } = useCheatingLog();
  const { values, errors, touched, handleBlur, handleChange, handleSubmit } = formik;
  const webcamRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureError, setCaptureError] = useState(null);

  const capture = useCallback(async () => {
    if (!webcamRef.current || !globalFaceapiReady) return;
    setIsProcessing(true);
    setCaptureError(null);

    const imageSrc = webcamRef.current.getScreenshot();

    try {
      // Validate the captured image using face-api
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => (img.onload = resolve));

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setImgSrc(imageSrc);
        onFaceCapture(imageSrc);
      } else {
        setCaptureError('No face detected in the capture. Please look directly at the camera and try again.');
      }
    } catch (err) {
      console.error('Processing error:', err);
      setCaptureError('Error processing the image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [webcamRef, onFaceCapture]);

  const retake = () => {
    setImgSrc(null);
    onFaceCapture(null);
    setCaptureError(null);
  };

  return (
    <>
      {title ? (
        <Typography fontWeight="700" variant="h2" mb={1}>
          {title}
        </Typography>
      ) : null}

      {subtext}

      <Box component="form">
        <Stack mb={1}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 3,
              p: 2,
              border: '1px solid #ccc',
              borderRadius: '8px',
            }}
          >
            <Typography variant="subtitle1" fontWeight={600} mb={1}>
              Face Enrollment (Required)
            </Typography>
            {imgSrc ? (
              <Box position="relative">
                <img
                  src={imgSrc}
                  alt="captured"
                  style={{ width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4CAF50' }}
                />
                <Box sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'white', borderRadius: '50%' }}>
                  <CheckCircle color="success" />
                </Box>
                <IconButton
                  onClick={retake}
                  sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: 'white' }}
                >
                  <Replay />
                </IconButton>
                <Typography variant="caption" display="block" textAlign="center" color="success.main" fontWeight="bold" mt={1}>
                  Face Captured Successfully
                </Typography>
              </Box>
            ) : (
              <Box position="relative" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  style={{ width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <Button
                  variant="contained"
                  disabled={!globalFaceapiReady || isProcessing}
                  size="small"
                  startIcon={isProcessing ? <CircularProgress size={16} /> : <CameraAlt />}
                  onClick={(e) => {
                    e.preventDefault();
                    capture();
                  }}
                  sx={{ mt: 1 }}
                >
                  {isProcessing ? 'Checking Face...' : 'Capture Face'}
                </Button>
                {captureError && (
                  <Alert severity="error" sx={{ mt: 1, p: 0, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                    {captureError}
                  </Alert>
                )}
                {!globalFaceapiReady && (
                  <Typography variant="caption" sx={{ mt: 1 }}>Initializing AI models...</Typography>
                )}
              </Box>
            )}
          </Box>

          <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor="name"
            mb="5px"
          >
            Name
          </Typography>
          <CustomTextField
            id="name"
            name="name"
            placeholder="Enter Your Name "
            variant="outlined"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.name && errors.name ? true : false}
            helperText={touched.name && errors.name ? errors.name : null}
            fullWidth
            required
          />

          {/* ... existing fields ... */}
          <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor="email"
            mb="5px"
            mt="10px"
          >
            Email Address
          </Typography>
          <CustomTextField
            id="email"
            name="email"
            variant="outlined"
            placeholder="Enter Your Email"
            value={values.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.email && errors.email ? true : false}
            helperText={touched.email && errors.email ? errors.email : null}
            required
            fullWidth
          />

          <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor="password"
            mb="5px"
            mt="10px"
          >
            Password
          </Typography>
          <CustomTextField
            id="password"
            name="password"
            type="password"
            variant="outlined"
            value={values.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.password && errors.password ? true : false}
            helperText={touched.password && errors.password ? errors.password : null}
            required
            fullWidth
          />
          <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor="confirm_password"
            mb="5px"
            mt="10px"
          >
            Confirm Password
          </Typography>
          <CustomTextField
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="false"
            variant="outlined"
            value={values.confirm_password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.confirm_password && errors.confirm_password ? true : false}
            helperText={
              touched.confirm_password && errors.confirm_password ? errors.confirm_password : null
            }
            fullWidth
            required
          />
          <Typography
            variant="subtitle1"
            fontWeight={600}
            component="label"
            htmlFor="role"
            mb="5px"
            mt="10px"
          >
            Role
          </Typography>
          <Select
            id="role"
            name="role"
            required
            displayEmpty
            value={values.role}
            onChange={handleChange}
            onBlur={handleBlur}
            error={!!(touched.role && errors.role)}
          >
            <MenuItem value="student">Student</MenuItem>
            <MenuItem value="teacher">Teacher</MenuItem>
          </Select>
        </Stack>
        <Button
          // size="small"
          color="primary"
          variant="contained"
          size="large"
          fullWidth
          // component={Link}
          // to="/auth/login"
          onClick={handleSubmit}
        // onClick={onSubmit} // Call the callback function on button click
        >
          Sign Up
        </Button>
      </Box>
      {subtitle}
    </>
  );
};
export default AuthRegister;
