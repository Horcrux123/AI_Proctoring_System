import React, { useEffect, useState } from 'react';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Container } from '@mui/material';
import { useNavigate, useParams } from 'react-router';
import axiosInstance from '../../../axios';
import { toast } from 'react-toastify';

export default function MultipleChoiceQuestion({ questions, saveUserTestScore, submitTest }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState(new Map());
  const navigate = useNavigate();
  const { examId } = useParams();

  const [isLastQuestion, setIsLastQuestion] = useState(false);
  const [isFinishTest, setisFinishTest] = useState(false);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setIsLastQuestion(currentQuestion === questions.length - 1);
    }
  }, [currentQuestion, questions]);

  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
  };

  const handleNextQuestion = async () => {
    if (!questions || questions.length === 0) return;

    let isCorrect = false;
    const currentQuestionData = questions[currentQuestion];

    if (currentQuestionData && currentQuestionData.options) {
      const correctOption = currentQuestionData.options.find((option) => option.isCorrect);
      if (correctOption && selectedOption) {
        isCorrect = correctOption._id === selectedOption;
      }
    }

    // Add answer to answers Map
    if (currentQuestionData) {
      setAnswers((prev) => {
        const newAnswers = new Map(prev);
        newAnswers.set(currentQuestionData._id, selectedOption);
        return newAnswers;
      });
    }

    if (isCorrect) {
      setScore(score + 1);
      saveUserTestScore();
    }

    if (isLastQuestion) {
      try {
        // Convert Map to object for API
        const answersObject = Object.fromEntries(answers);

        // Add the current answer if it's the last question
        if (selectedOption && currentQuestionData) {
          answersObject[currentQuestionData._id] = selectedOption;
        }

        // Send results to the backend
        await axiosInstance.post(
          '/api/users/results',
          {
            examId,
            answers: answersObject,
          },
          {
            withCredentials: true,
          },
        );

        navigate(`/exam/${examId}/codedetails`);
      } catch (error) {
        console.error('Error saving results:', error);
        toast.error('Failed to save results');
      }
    }

    setSelectedOption(null);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setisFinishTest(true);
    }
  };

  if (!questions || questions.length === 0) {
    return (
      <Card
        style={{
          width: '50%',
          boxShadow: '2px',
        }}
      >
        <CardContent>
          <Typography variant="h5" color="error" align="center">
            No MCQ questions available for this exam.
          </Typography>
          <Box mt={2} display="flex" justifyContent="center">
            <Button variant="contained" onClick={() => navigate(`/exam/${examId}/codedetails`)}>
              Skip to Coding Section
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  const currentQuestionData = questions[currentQuestion];

  if (!currentQuestionData) {
    return (
      <Card
        style={{
          width: '50%',
          boxShadow: '2px',
        }}
      >
        <CardContent>
          <Typography variant="h5" color="error" align="center">
            Question not found.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      style={{
        width: '50%',
        boxShadow: '2px',
      }}
    >
      <CardContent
        style={{
          boxShadow: '4px',
          padding: '2px',
          paddingRight: '4px',
          margin: '3px',
        }}
      >
        <Typography variant="h4" mb={3}>
          Question {currentQuestion + 1}:
        </Typography>
        <Typography variant="body1" mb={3}>
          {currentQuestionData.question}
        </Typography>
        <Box mb={10}>
          <FormControl component="fieldset">
            <RadioGroup
              aria-label="quiz"
              name="quiz"
              value={selectedOption}
              onChange={handleOptionChange}
            >
              {currentQuestionData.options?.map((option) => (
                <FormControlLabel
                  key={option._id}
                  value={option._id}
                  control={<Radio />}
                  label={option.optionText}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button
            variant="contained"
            color="primary"
            onClick={handleNextQuestion}
            disabled={selectedOption === null}
            style={{ marginLeft: 'auto' }}
          >
            {isLastQuestion ? 'Proceed to Coding' : 'Next Question'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
