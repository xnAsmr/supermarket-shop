package com.supermarket.erp.common.controller;

import com.supermarket.erp.common.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Tag(name = "文件上传")
@RestController
@RequestMapping("/api/v1/upload")
public class FileUploadController {

    @Value("${file.upload-dir:uploads}")
    private String uploadDir;

    private Path uploadPath;

    private static final Set<String> IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".gif", ".webp");
    private static final Set<String> VIDEO_EXTENSIONS = Set.of(".mp4", ".webm", ".mov", ".avi", ".mkv");

    @PostConstruct
    public void init() {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        System.out.println("[FileUpload] 上传目录: " + this.uploadPath);
    }

    @Operation(summary = "上传图片")
    @PostMapping("/image/{category}")
    public Result<String> uploadImage(
            @PathVariable String category,
            @RequestParam("file") MultipartFile file) {
        return uploadFile(category, file, IMAGE_EXTENSIONS, "只支持 jpg/png/gif/webp 格式");
    }

    /**
     * 富文本编辑器（wangEditor）图片上传
     * 返回 wangEditor 约定的 { errno: 0, data: { url, alt, href } } 格式（非 Result 包装）
     */
    @Operation(summary = "富文本编辑器图片上传（wangEditor）")
    @PostMapping("/wangeditor")
    public Map<String, Object> uploadForWangeditor(@RequestParam("file") MultipartFile file) {
        Result<String> result = uploadFile("notice", file, IMAGE_EXTENSIONS, "只支持 jpg/png/gif/webp 格式");
        if (result.getCode() != 200) {
            return wangeditorError(result.getMessage());
        }
        return wangeditorImageData(result.getData(), file);
    }

    /**
     * 富文本编辑器（wangEditor）视频上传
     * 返回 wangEditor 约定的 { errno: 0, data: { url, poster } } 格式（poster 封面图可选，留空取视频首帧）
     */
    @Operation(summary = "富文本编辑器视频上传（wangEditor）")
    @PostMapping("/wangeditor-video")
    public Map<String, Object> uploadVideoForWangeditor(@RequestParam("file") MultipartFile file) {
        Result<String> result = uploadFile("notice", file, VIDEO_EXTENSIONS, "只支持 mp4/webm/mov/avi/mkv 视频格式");
        if (result.getCode() != 200) {
            return wangeditorError(result.getMessage());
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", result.getData());
        data.put("poster", "");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("errno", 0);
        body.put("data", data);
        return body;
    }

    /** 通用落盘：校验扩展名 → UUID 命名 → 返回可访问 URL */
    private Result<String> uploadFile(
            String category, MultipartFile file, Set<String> allowedExtensions, String extErrorMessage) {
        if (file.isEmpty()) {
            return Result.fail("文件不能为空");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null) {
            return Result.fail("文件名不能为空");
        }

        String ext = getExtension(originalName).toLowerCase();
        if (!allowedExtensions.contains(ext)) {
            return Result.fail(extErrorMessage);
        }

        try {
            String fileName = UUID.randomUUID().toString().replace("-", "") + ext;
            Path categoryDir = uploadPath.resolve(category);
            Files.createDirectories(categoryDir);

            Path filePath = categoryDir.resolve(fileName);
            file.transferTo(filePath.toFile());

            String url = "/api/v1/upload/file/" + category + "/" + fileName;
            return Result.success(url);
        } catch (IOException e) {
            return Result.fail("上传失败: " + e.getMessage());
        }
    }

    private Map<String, Object> wangeditorImageData(String url, MultipartFile file) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("alt", file.getOriginalFilename());
        data.put("href", url);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("errno", 0);
        body.put("data", data);
        return body;
    }

    private Map<String, Object> wangeditorError(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("errno", 1);
        body.put("message", message == null ? "上传失败" : message);
        return body;
    }

    @Operation(summary = "读取文件（支持 Range 断点传输，视频可拖动进度）")
    @GetMapping("/file/{category}/{filename:.+}")
    public ResponseEntity<ResourceRegion> getFile(
            @PathVariable String category,
            @PathVariable String filename,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            Path filePath = uploadPath.resolve(category).resolve(filename).normalize();

            if (!filePath.startsWith(uploadPath) || !Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(filePath);
            String contentType = Files.probeContentType(filePath);
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            long fileLength = resource.contentLength();

            // 无 Range 头：整文件 200 返回（图片等小资源）
            if (!StringUtils.hasText(rangeHeader) || !rangeHeader.startsWith("bytes=")) {
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                        .body(new ResourceRegion(resource, 0, fileLength));
            }

            // 单 Range（bytes=start-end）：206 返回，视频拖动进度依赖此分支
            String[] bounds = rangeHeader.substring("bytes=".length()).split("-", 2);
            long start = bounds[0].trim().isEmpty() ? 0 : Long.parseLong(bounds[0].trim());
            long end =
                    bounds.length > 1 && !bounds[1].trim().isEmpty()
                            ? Long.parseLong(bounds[1].trim())
                            : fileLength - 1;
            long last = Math.max(0, fileLength - 1);
            start = Math.max(0, Math.min(start, last));
            end = Math.max(start, Math.min(end, last));
            long rangeLength = end - start + 1;

            return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileLength)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .contentLength(rangeLength)
                    .body(new ResourceRegion(resource, start, rangeLength));
        } catch (IOException | NumberFormatException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
