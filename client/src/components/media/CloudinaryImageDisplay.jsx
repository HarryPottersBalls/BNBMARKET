import React from 'react';
import { Cloudinary } from '@cloudinary/url-gen';
import { auto } from '@cloudinary/url-gen/actions/resize';
import { autoGravity } from '@cloudinary/url-gen/qualifiers/gravity';
import { AdvancedImage } from '@cloudinary/react';

// Get Cloudinary cloud name from environment variable
const getCloudName = () => {
  const cloudName =
    process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ||
    process.env.VITE_CLOUDINARY_CLOUD_NAME ||
    import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    throw new Error(
      'Cloudinary cloud name is required. Please set REACT_APP_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_CLOUD_NAME in your .env file.'
    );
  }

  return cloudName;
};

const CloudinaryImageDisplay = () => {
  const cld = new Cloudinary({ cloud: { cloudName: getCloudName() } });

  // Use this sample image or upload your own via the Media Explorer
  const img = cld
    .image('cld-sample-5') // Using a sample image
    .format('auto')
    .quality('auto')
    .resize(auto().gravity(autoGravity()).width(500).height(500));

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <AdvancedImage cldImg={img} />
    </div>
  );
};

export default CloudinaryImageDisplay;
