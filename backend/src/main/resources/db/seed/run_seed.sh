#!/usr/bin/env bash
set -eu

mkdir -p /uploads
chown 10001:10001 /uploads
chmod 0775 /uploads

# Tạo một PDF tối giản hợp lệ; dùng base64 để không phụ thuộc quy tắc CRLF của máy chạy seed.
pdf_base64='JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAxMDkgPj4Kc3RyZWFtCkJUCi9GMSAxOCBUZgo3MiA3NjAgVGQKKENvZGVKdWRnZSAtIFRhaSBsaWV1IG1hdSkgVGoKMCAtMjggVGQKL0YxIDEyIFRmCihUYWkgbGlldSBQREYgY2hvIGNodW9uZyBob2MuKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDQwMCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ3MAolJUVPRgo='
printf '%s' "${pdf_base64}" | base64 --decode > /tmp/demo-material.pdf

for class_no in 1 2 3; do
  for chapter_no in 1 2 3 4 5; do
    target="/uploads/demo-class-${class_no}-chapter-${chapter_no}.pdf"
    cp /tmp/demo-material.pdf "${target}"
    chown 10001:10001 "${target}"
    chmod 0644 "${target}"
  done
done

exec psql -v ON_ERROR_STOP=1 -q -f /seed/demo_data.sql
