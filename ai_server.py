# Server to handle AI API requests

from flask import Flask, request, jsonify
import base64
from io import BytesIO
from pdfminer.high_level import extract_text
import cohere
from youtube_transcript_api import YouTubeTranscriptApi
from docx import Document

app = Flask(__name__)

@app.route('/process_pdf', methods=['POST'])
def process_pdf():
    file = request.form['file']

    # Assuming 'file' contains the Base64-encoded PDF file data received over WebSocket
    base64_data = file.encode('utf-8')  # Convert string to bytes
    pdf_data = base64.b64decode(base64_data)

    # Create a BytesIO object to work with pdfminer
    pdf_stream = BytesIO(pdf_data)

    # Extract text content from PDF
    text = extract_text(pdf_stream)

    # print("Text content of the PDF:", text)

    response = {'data': get_summary(text)}
    
    return jsonify(response)

@app.route('/process_file', methods=['POST'])
def process_file():
    text = request.form['file']

    # Decode Base64 content
    decoded_bytes = base64.b64decode(text)
    
    # Convert bytes to string
    try:
        text = decoded_bytes.decode('utf-8')
    except:
        # Create a file-like object from the decoded data
        docx_file_like = BytesIO(decoded_bytes)

        doc = Document(docx_file_like)

        # Initialize an empty string to hold the text content
        text = ""
        
        # Iterate through each paragraph in the document and concatenate the text
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"

    response = {'data': get_summary(text)}
    
    return jsonify(response)

@app.route('/process_video', methods=['GET'])
def process_video():
    video_id = request.args.get('videoId')
    
    print(video_id)

    transcript = " ".join([chunk.get("text") for chunk in catch(lambda: YouTubeTranscriptApi.get_transcript(video_id))]).replace("\n", " ")

    if len(transcript) == 0:
        data = "No transcript to summarize."
    elif len(transcript) < 250:
        data = transcript
    else:
        data = get_summary(transcript)

    response = {'data': data}

    return jsonify(response)

def get_summary(text):
    # Get summary
    API_KEY = 'urUHBanFf5qq0F39mHGIPdWV9tvDqe3198WQ0Zq3'
    co = cohere.Client(API_KEY)

    # summarize transcript using Cohere
    try:
        response = co.summarize(
            text=text,
            format='bullets',
            length='medium'
        )
    except cohere.CohereError as e:
        print(e)
        return "Unable to get summary. Try sending another file."
    
    print(response.summary)
    
    return response.summary

def catch(func, handle=lambda e : e, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except:
        return ""

if __name__ == '__main__':
    # Run the Flask app on port 3001
    app.run(host='0.0.0.0', port=3001, debug=True)
