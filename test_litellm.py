import yaml
config = """
model_list:
  - model_name: test
    litellm_params:
      model: groq/test
      api_key: os.environ/MISSING_KEY
"""
import os
try:
    print("Testing if litellm crashes...")
except Exception as e:
    print(e)
