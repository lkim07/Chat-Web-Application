# Proposal

1. **Provide a brief, high-level description of the Al-based feature in a few sentences.**  
Users can include images, PDFs, text, and videos in chat messages, and Al is used to recognize the content, then generate a summary of it, and provide it to the user.

2. **Imagine a user using this new Al-based feature, and describe the user experience.**  
Users click a button to upload images, pdfs, videos and documents, and the uploaded documents or videos are displayed in the chat view. After that, when the users press a summary button, Al summarizes the information and displays its text summary at the bottom of the chat page.

3. **Roughly describe how you will implement this feature. Think about the components you will need -- Ul components, server-side endpoints, any ML models you'll be hosting, or external services you will be communicating with, etc. You don't have to be very precise, but this will be an opportunity for you to estimate the development effort you'll be putting in.**
- An upload button for uploading images, PDFs, and videos
- A server-side handler to receive uploaded images, videos and text.
- Image-text, video-text models for processing
- Updated chat message Ul component that can render captioned images and videos
